import Phaser from "phaser";
import { GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import { PANIC_LEVELS, PanicLevel } from "@/config/alarmClock";
import { COLORS } from "@/config/theme";
import { createButton } from "@/ui/Button";
import { bodyText, drawPill, hex, titleText } from "@/ui/ui";

const TOP_Y = 14;
const ROW_H = 64;
const CENTER_Y = TOP_Y + ROW_H / 2;

const PANIC_CELL_COLORS = [COLORS.panicCalm, COLORS.panicWarm, COLORS.panicHot, COLORS.red];

/** In-game overlay, laid out like the "Partie" mockup: pause + turn, score + timer, alarm gauge, hint banner, GO. */
export class HUD {
  private readonly scoreTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly gameLabel: Phaser.GameObjects.Text;
  private readonly gameLabelBg: Phaser.GameObjects.Graphics;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly timerRing: Phaser.GameObjects.Graphics;
  private readonly panicCells: Phaser.GameObjects.Graphics;
  private readonly panicLabel: Phaser.GameObjects.Text;
  private readonly bannerBg: Phaser.GameObjects.Graphics;
  private readonly bannerName: Phaser.GameObjects.Text;
  private readonly bannerHint: Phaser.GameObjects.Text;
  private bannerTeam: TeamId | null = null;
  private readonly goButton: Phaser.GameObjects.Container;
  private readonly pauseButton: Phaser.GameObjects.Container;
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private readonly timerParts: Phaser.GameObjects.GameObject[];

  private readonly timerCx = 1040;

  constructor(
    scene: Phaser.Scene,
    onGo: () => void,
    onPause: () => void,
  ) {
    const depth = 50;
    const track = <T extends Phaser.GameObjects.GameObject & { setDepth(d: number): T }>(o: T): T => {
      o.setDepth(depth);
      this.all.push(o);
      return o;
    };

    // Pause (round) + turn pill.
    this.pauseButton = createButton(scene, 52, CENTER_Y - 3, "", onPause, { width: 56, height: 56, variant: "ghost" });
    const pauseIcon = scene.add.graphics();
    pauseIcon.fillStyle(0xe9edf7, 1);
    pauseIcon.fillRoundedRect(-11, -13, 8, 26, 3);
    pauseIcon.fillRoundedRect(3, -13, 8, 26, 3);
    (this.pauseButton.list[1] as Phaser.GameObjects.Container).add(pauseIcon);
    track(this.pauseButton);

    this.gameLabelBg = track(scene.add.graphics());
    this.gameLabel = track(scene.add.text(96 + 22, CENTER_Y, "", bodyText(22, COLORS.textSoft))).setOrigin(0, 0.5);
    this.setGameLabel("Foot");

    // Score pill.
    const cx = 760;
    const scoreBg = track(scene.add.graphics());
    drawPill(scoreBg, cx - 235, TOP_Y, 470, ROW_H);
    const dots = track(scene.add.graphics());
    dots.fillStyle(TEAM_COLORS.red, 1);
    dots.fillCircle(cx - 200, CENTER_Y, 8);
    dots.fillStyle(TEAM_COLORS.yellow, 1);
    dots.fillCircle(cx + 200, CENTER_Y, 8);
    const label = (text: string, x: number) => track(scene.add.text(x, CENTER_Y, text, bodyText(20, COLORS.textSoft, "700"))).setOrigin(0.5).setLetterSpacing(2);
    label("ROUGE", cx - 140);
    label("JAUNE", cx + 140);
    this.scoreTexts = [
      track(scene.add.text(cx - 50, CENTER_Y, "0", titleText(42))).setOrigin(0.5),
      track(scene.add.text(cx + 50, CENTER_Y, "0", titleText(42))).setOrigin(0.5),
    ];
    track(scene.add.text(cx, CENTER_Y - 2, "–", bodyText(34, COLORS.textFaint))).setOrigin(0.5);

    // Aim timer ring.
    const ringBg = track(scene.add.graphics());
    ringBg.fillStyle(COLORS.panel, 1);
    ringBg.fillCircle(this.timerCx, CENTER_Y, 32);
    ringBg.lineStyle(6, COLORS.panelBorder, 1);
    ringBg.strokeCircle(this.timerCx, CENTER_Y, 28);
    this.timerRing = track(scene.add.graphics());
    this.timerText = track(scene.add.text(this.timerCx, CENTER_Y + 1, "15", titleText(22))).setOrigin(0.5);
    this.timerParts = [ringBg, this.timerRing, this.timerText];

    // Alarm clock gauge.
    const panicW = 390;
    const panicX = GAME_WIDTH - 48 - panicW;
    const panicBg = track(scene.add.graphics());
    drawPill(panicBg, panicX, TOP_Y, panicW, ROW_H);
    track(scene.add.text(panicX + 28, CENTER_Y, "RÉVEIL", bodyText(18, COLORS.textMuted, "700"))).setOrigin(0, 0.5).setLetterSpacing(2);
    this.panicCells = track(scene.add.graphics());
    this.panicCells.setPosition(panicX + 128, CENTER_Y);
    this.panicLabel = track(scene.add.text(panicX + panicW - 26, CENTER_Y, "", bodyText(22, hex(COLORS.panicWarm), "700"))).setOrigin(1, 0.5);

    // Bottom-left hint banner.
    this.bannerBg = track(scene.add.graphics());
    this.bannerName = track(scene.add.text(0, 0, "", bodyText(24, COLORS.textMain, "700"))).setOrigin(0, 0.5);
    this.bannerHint = track(scene.add.text(0, 0, "", bodyText(24, COLORS.textMuted, "500"))).setOrigin(0, 0.5);

    // GO.
    this.goButton = createButton(scene, GAME_WIDTH - 100, 786, "GO", onGo, { width: 120, round: true, fontSize: 44 });
    track(this.goButton);

    this.setPanic(0);
    this.setAimTimer(1, 1);
  }

  setScore(score: Record<TeamId, number>): void {
    this.scoreTexts[0].setText(String(score.red));
    this.scoreTexts[1].setText(String(score.yellow));
  }

  /** Top-left pill, e.g. "Jeu 1/3 · Foot". It grows with its text. */
  setGameLabel(label: string): void {
    this.gameLabel.setText(label);
    this.gameLabelBg.clear();
    drawPill(this.gameLabelBg, 96, CENTER_Y - 22, this.gameLabel.width + 44, 44, 18);
  }

  setAimTimer(remainingMs: number, durationMs: number): void {
    const ratio = Phaser.Math.Clamp(remainingMs / durationMs, 0, 1);
    this.timerText.setText(Math.ceil(remainingMs / 1000).toString());
    this.timerRing.clear();
    if (ratio <= 0) return;
    this.timerRing.lineStyle(6, ratio > 0.25 ? COLORS.yellow : COLORS.red, 1);
    this.timerRing.beginPath();
    this.timerRing.arc(this.timerCx, CENTER_Y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    this.timerRing.strokePath();
  }

  setPanic(level: PanicLevel): void {
    const g = this.panicCells;
    g.clear();
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i <= level ? PANIC_CELL_COLORS[i] : COLORS.panicOff, 1);
      g.fillRoundedRect(i * 30, -9, 24, 18, 5);
    }
    this.panicLabel.setText(PANIC_LEVELS[level].label).setColor(hex(PANIC_CELL_COLORS[level]));
  }

  /** Bottom-left hint. `team` colors the dot; pass null to hide the banner. */
  setBanner(team: TeamId | null, name: string, hint: string): void {
    this.bannerTeam = team;
    const visible = team !== null;
    this.bannerBg.setVisible(visible);
    this.bannerName.setVisible(visible);
    this.bannerHint.setVisible(visible);
    if (!visible) return;

    const x = 28;
    const y = 846;
    const padX = 20;
    this.bannerName.setText(name).setPosition(x + padX + 24, y);
    this.bannerHint.setText(hint).setPosition(this.bannerName.x + this.bannerName.width + 10, y);
    const w = this.bannerHint.x + this.bannerHint.width + padX - x;
    this.bannerBg.clear();
    drawPill(this.bannerBg, x, y - 26, w, 52, 18);
    this.bannerBg.fillStyle(TEAM_COLORS[team], 1);
    this.bannerBg.fillCircle(x + padX + 6, y, 7);
  }

  get currentBannerTeam(): TeamId | null {
    return this.bannerTeam;
  }

  setGoVisible(visible: boolean): void {
    this.goButton.setVisible(visible);
  }

  setTimerVisible(visible: boolean): void {
    for (const o of this.timerParts) (o as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(visible);
  }

  destroy(): void {
    for (const o of this.all) o.destroy();
  }
}

