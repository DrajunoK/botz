import Phaser from "phaser";
import { GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import type { HudLayout } from "@/game/modes/GameMode";
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
  /** The alarm-clock gauge: hidden in games that have no clock. */
  private readonly alarmParts: Phaser.GameObjects.GameObject[] = [];
  /** The numeric score: hidden when botz-still-standing icons are shown instead. */
  private readonly scoreParts: Phaser.GameObjects.GameObject[] = [];
  private readonly standingG: Phaser.GameObjects.Graphics;
  private readonly scoreBg: Phaser.GameObjects.Graphics;
  private readonly scoreDots: Phaser.GameObjects.Graphics;
  private readonly teamLabels: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly noticeBg: Phaser.GameObjects.Graphics;
  private readonly noticeText: Phaser.GameObjects.Text;

  private readonly timerCx = 1040;
  private readonly standingCx = 735;

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
    this.scoreBg = track(scene.add.graphics());
    this.scoreDots = track(scene.add.graphics());
    const label = (text: string) => track(scene.add.text(0, CENTER_Y, text, bodyText(20, COLORS.textSoft, "700"))).setOrigin(0.5).setLetterSpacing(2);
    this.teamLabels = [label("ROUGE"), label("JAUNE")];
    this.drawScoreFrame(false);
    this.scoreTexts = [
      track(scene.add.text(cx - 50, CENTER_Y, "0", titleText(42))).setOrigin(0.5),
      track(scene.add.text(cx + 50, CENTER_Y, "0", titleText(42))).setOrigin(0.5),
    ];
    const dash = track(scene.add.text(cx, CENTER_Y - 2, "–", bodyText(34, COLORS.textFaint))).setOrigin(0.5);
    this.scoreParts.push(...this.scoreTexts, dash);
    this.standingG = track(scene.add.graphics()).setVisible(false);

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
    const alarmLabel = track(scene.add.text(panicX + 28, CENTER_Y, "RÉVEIL", bodyText(18, COLORS.textMuted, "700"))).setOrigin(0, 0.5).setLetterSpacing(2);
    this.panicCells = track(scene.add.graphics());
    this.panicCells.setPosition(panicX + 128, CENTER_Y);
    this.panicLabel = track(scene.add.text(panicX + panicW - 26, CENTER_Y, "", bodyText(22, hex(COLORS.panicWarm), "700"))).setOrigin(1, 0.5);
    this.alarmParts.push(panicBg, alarmLabel, this.panicCells, this.panicLabel);

    // Warning pill, in the gauge's place when the game has none ("Rétrécit dans 1 tour").
    this.noticeBg = track(scene.add.graphics()).setVisible(false);
    this.noticeText = track(scene.add.text(0, CENTER_Y, "", bodyText(24, hex(COLORS.panicHot), "700"))).setOrigin(0, 0.5).setVisible(false);

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

  /** Picks the HUD blocks the current game uses. */
  configure(layout: HudLayout): void {
    for (const o of this.alarmParts) (o as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(layout.alarmGauge);
    for (const o of this.scoreParts) (o as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(!layout.standings);
    this.standingG.setVisible(layout.standings);
    this.drawScoreFrame(layout.standings);
  }

  /** The pill behind the score: wider (and shifted left, clear of the timer) when it holds botz icons. */
  private drawScoreFrame(standings: boolean): void {
    const cx = standings ? this.standingCx : 760;
    const half = standings ? 250 : 235;
    const edge = standings ? 225 : 200;
    const labelOffset = standings ? 155 : 140;
    this.scoreBg.clear();
    drawPill(this.scoreBg, cx - half, TOP_Y, half * 2, ROW_H);
    this.scoreDots.clear();
    this.scoreDots.fillStyle(TEAM_COLORS.red, 1);
    this.scoreDots.fillCircle(cx - edge, CENTER_Y, 8);
    this.scoreDots.fillStyle(TEAM_COLORS.yellow, 1);
    this.scoreDots.fillCircle(cx + edge, CENTER_Y, 8);
    this.teamLabels[0].setX(cx - labelOffset);
    this.teamLabels[1].setX(cx + labelOffset);
  }

  /** Botz still in play per team, by bot index (true = standing): filled icons, crossed-out when lost. */
  setStanding(red: readonly boolean[], yellow: readonly boolean[]): void {
    const g = this.standingG;
    g.clear();
    const cx = this.standingCx;
    const icon = (x: number, standing: boolean, color: number) => {
      if (standing) {
        g.fillStyle(color, 1);
        g.fillRoundedRect(x - 13, CENTER_Y - 9, 26, 18, 9);
        g.fillStyle(COLORS.botVisor, 1);
        g.fillRoundedRect(x - 7, CENTER_Y - 3, 14, 6, 3);
      } else {
        g.fillStyle(COLORS.panelBorder, 1);
        g.fillCircle(x, CENTER_Y, 12);
        g.lineStyle(3, 0xc9d2e8, 1);
        g.lineBetween(x - 5, CENTER_Y - 5, x + 5, CENTER_Y + 5);
        g.lineBetween(x + 5, CENTER_Y - 5, x - 5, CENTER_Y + 5);
      }
    };
    red.forEach((standing, i) => icon(cx - 24 - i * 34, standing, TEAM_COLORS.red));
    yellow.forEach((standing, i) => icon(cx + 24 + i * 34, standing, TEAM_COLORS.yellow));
  }

  /** Pill at the top right (orange with a warning triangle, or plain info); pass null to hide it. */
  setNotice(text: string | null, warning = true): void {
    const visible = text !== null;
    this.noticeBg.setVisible(visible);
    this.noticeText.setVisible(visible);
    this.noticeBg.clear();
    if (text === null) return;
    this.noticeText.setText(text);
    const w = this.noticeText.width + (warning ? 96 : 56);
    const x = GAME_WIDTH - 48 - w;
    this.noticeBg.fillStyle(COLORS.panel, 1);
    this.noticeBg.fillRoundedRect(x, TOP_Y, w, ROW_H, ROW_H / 2);
    this.noticeBg.lineStyle(3, warning ? COLORS.panicHot : COLORS.panelBorder, 1);
    this.noticeBg.strokeRoundedRect(x, TOP_Y, w, ROW_H, ROW_H / 2);
    this.noticeText.setColor(warning ? hex(COLORS.panicHot) : COLORS.textMain);
    if (!warning) {
      this.noticeText.setPosition(x + 28, CENTER_Y);
      return;
    }
    // Warning triangle.
    const tx = x + 40;
    this.noticeBg.lineStyle(3, COLORS.panicHot, 1);
    this.noticeBg.strokePoints(
      [new Phaser.Math.Vector2(tx, CENTER_Y - 14), new Phaser.Math.Vector2(tx + 15, CENTER_Y + 12), new Phaser.Math.Vector2(tx - 15, CENTER_Y + 12)],
      true,
    );
    this.noticeBg.lineBetween(tx, CENTER_Y - 4, tx, CENTER_Y + 3);
    this.noticeBg.fillStyle(COLORS.panicHot, 1);
    this.noticeBg.fillCircle(tx, CENTER_Y + 8, 1.6);
    this.noticeText.setPosition(x + 68, CENTER_Y);
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

