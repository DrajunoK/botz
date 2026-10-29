import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TEAM_COLORS, TEAM_LABEL, TeamId } from "@/config/game";
import { ALL_PARTS, PartId } from "@/config/parts";
import { COLORS } from "@/config/theme";
import { SceneKeys } from "./keys";
import { createButton } from "@/ui/Button";
import { bodyText, drawPill, hex, titleText } from "@/ui/ui";
import { MatchConfig, newSeed } from "@/game/MatchConfig";
import { drawBot, drawBotShadow, drawSmoke } from "@/game/view/botArt";
import { fillSpark } from "@/game/view/draw";

export interface BotEndState {
  team: TeamId;
  index: number;
  parts: PartId[];
}

export interface ResultData {
  winner: TeamId;
  score: Record<TeamId, number>;
  matchConfig: MatchConfig;
  /** Parts each bot still had at the final whistle. */
  botState: BotEndState[];
}

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;
  private smokers: { g: Phaser.GameObjects.Graphics; phase: number }[] = [];
  private t = 0;

  constructor() {
    super(SceneKeys.Result);
  }

  init(data: ResultData): void {
    this.resultData = data;
    this.smokers = [];
    this.t = 0;
  }

  create(): void {
    const { winner, score, botState } = this.resultData;
    const color = TEAM_COLORS[winner];

    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(COLORS.night, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(color, 0.12);
    bg.fillCircle(GAME_WIDTH / 2, 200, 420);
    const confetti = this.add.graphics().setDepth(-9);
    const palette = [COLORS.red, COLORS.yellow, 0x5fc2a8, 0x8fa0c4];
    for (let i = 0; i < 46; i++) {
      const x = (i * 193) % GAME_WIDTH;
      const y = (i * 127) % 420;
      fillSpark(confetti, x, y, 6 + (i % 4) * 2, palette[i % palette.length], 0.55);
    }

    this.add.text(GAME_WIDTH / 2, 130, `${TEAM_LABEL[winner]} GAGNE !`, titleText(92, hex(color))).setOrigin(0.5).setStroke(hex(COLORS.outline), 12);

    // Score pill.
    const pill = this.add.graphics();
    drawPill(pill, GAME_WIDTH / 2 - 270, 210, 540, 84);
    pill.fillStyle(TEAM_COLORS.red, 1);
    pill.fillCircle(GAME_WIDTH / 2 - 235, 252, 10);
    pill.fillStyle(TEAM_COLORS.yellow, 1);
    pill.fillCircle(GAME_WIDTH / 2 + 235, 252, 10);
    this.add.text(GAME_WIDTH / 2 - 165, 252, "ROUGE", bodyText(24, COLORS.textSoft, "700")).setOrigin(0.5).setLetterSpacing(2);
    this.add.text(GAME_WIDTH / 2 + 165, 252, "JAUNE", bodyText(24, COLORS.textSoft, "700")).setOrigin(0.5).setLetterSpacing(2);
    this.add.text(GAME_WIDTH / 2 - 62, 252, String(score.red), titleText(54)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2 + 62, 252, String(score.yellow), titleText(54)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 250, "–", bodyText(44, COLORS.textFaint)).setOrigin(0.5);

    // State of every bot at the final whistle.
    this.add.text(GAME_WIDTH / 2, 365, "ÉTAT DES BOTZ", titleText(24, COLORS.textFaint)).setOrigin(0.5);
    this.drawSquad("red", botState, GAME_WIDTH / 2 - 300, 500);
    this.drawSquad("yellow", botState, GAME_WIDTH / 2 + 300, 500);

    createButton(this, GAME_WIDTH / 2 - 230, 770, "Rejouer", () => {
      this.scene.start(SceneKeys.Game, { ...this.resultData.matchConfig, seed: newSeed() });
    }, { variant: "primary", width: 380 });
    createButton(this, GAME_WIDTH / 2 + 230, 770, "Menu", () => this.scene.start(SceneKeys.Menu), { variant: "ghost", width: 380 });
  }

  update(_time: number, delta: number): void {
    this.t += delta / 1000;
    for (const s of this.smokers) drawSmoke(s.g, this.t + s.phase);
  }

  private drawSquad(team: TeamId, all: BotEndState[], cx: number, cy: number): void {
    const squad = all.filter((b) => b.team === team).sort((a, b) => a.index - b.index);
    this.add.text(cx, cy - 100, `BOTZ ${TEAM_LABEL[team]}S`, bodyText(24, hex(TEAM_COLORS[team]), "700")).setOrigin(0.5).setLetterSpacing(2);

    squad.forEach((b, i) => {
      const x = cx + (i - (squad.length - 1) / 2) * 170;
      const scale = 2.3;
      const lost = ALL_PARTS.length - b.parts.length;
      const wreck = b.parts.length === 0;

      const shadow = this.add.graphics();
      drawBotShadow(shadow);
      shadow.setPosition(x, cy).setScale(scale);
      const g = this.add.graphics();
      drawBot(g, TEAM_COLORS[team], { has: (p) => b.parts.includes(p), lostCount: lost, isWreck: wreck });
      g.setPosition(x, cy).setScale(scale);
      if (wreck) {
        const smoke = this.add.graphics().setPosition(x, cy).setScale(scale);
        this.smokers.push({ g: smoke, phase: i * 0.37 });
      }

      const caption = wreck ? "Épave" : lost === 0 ? "Comme neuf" : `${b.parts.length}/${ALL_PARTS.length} pièces`;
      this.add.text(x, cy + 80, caption, bodyText(22, wreck ? hex(COLORS.panicHot) : COLORS.textMuted, "600")).setOrigin(0.5);
    });
  }
}
