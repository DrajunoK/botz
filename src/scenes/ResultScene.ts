import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TEAM_COLORS, TeamId } from "@/config/game";
import { SceneKeys } from "./keys";
import { createButton } from "@/ui/Button";
import { MatchConfig } from "@/game/MatchConfig";
import { drawBotIcon } from "@/game/entities/botArt";

export interface ResultData {
  winner: TeamId;
  score: Record<TeamId, number>;
  matchConfig: MatchConfig;
}

const BG_TOP = 0x0b1020;
const BG_BOTTOM = 0x161d33;

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;

  constructor() {
    super(SceneKeys.Result);
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    const color = TEAM_COLORS[this.resultData.winner];
    const label = this.resultData.winner === "red" ? "ROUGE" : "JAUNE";

    const bg = this.add.graphics().setDepth(-10);
    bg.fillGradientStyle(BG_TOP, BG_TOP, BG_BOTTOM, BG_BOTTOM, 1, 1, 1, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const glow = this.add.graphics().setDepth(-9);
    glow.fillStyle(color, 0.18);
    glow.fillCircle(GAME_WIDTH / 2, 230, 340);

    const mascot = this.add.graphics().setDepth(-8);
    drawBotIcon(mascot, color, 64, this.resultData.winner === "red" ? 1 : -1);
    mascot.setPosition(GAME_WIDTH / 2, 220);
    this.tweens.add({ targets: mascot, y: mascot.y - 16, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(GAME_WIDTH / 2, 380, `${label} GAGNE !`, {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "68px",
        color: "#f8fafc",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    const scorePanel = this.add.graphics();
    const panelW = 240;
    scorePanel.fillStyle(0x0b1220, 0.5);
    scorePanel.fillRoundedRect(GAME_WIDTH / 2 - panelW / 2, 430, panelW, 76, 18);
    scorePanel.lineStyle(1.5, 0xffffff, 0.12);
    scorePanel.strokeRoundedRect(GAME_WIDTH / 2 - panelW / 2, 430, panelW, 76, 18);

    this.add
      .text(GAME_WIDTH / 2, 468, `${this.resultData.score.red}  -  ${this.resultData.score.yellow}`, {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "44px",
        color: "#cbd5e1",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, 610, "Rejouer", () => {
      this.scene.start(SceneKeys.Game, this.resultData.matchConfig);
    }, { fillColor: 0x2563eb, icon: "play" });

    createButton(this, GAME_WIDTH / 2, 710, "Menu", () => this.scene.start(SceneKeys.Menu), {
      fillColor: 0x475569,
    });
  }
}
