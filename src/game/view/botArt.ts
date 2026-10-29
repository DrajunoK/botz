import Phaser from "phaser";
import { COLORS } from "@/config/theme";
import { PartId } from "@/config/parts";
import { fillSpark, roundLine } from "@/game/view/draw";

/**
 * Botz art, drawn in the mockups' native units (body radius 18) — scale the Graphics
 * object by BOT_RADIUS / BOT_ART_RADIUS to size it. Each part is drawn by its own
 * function so it can be left out when it falls off (and reused for debris).
 */
export const BOT_ART_RADIUS = 18;

export function drawWheel(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.botWheel, 1);
  g.fillRoundedRect(-10, 12, 20, 9, 4.5);
  g.fillStyle(COLORS.botWheelHub, 1);
  g.fillCircle(-5, 16.5, 2);
  g.fillCircle(5, 16.5, 2);
}

export function drawArm(g: Phaser.GameObjects.Graphics, side: "left" | "right"): void {
  const x = side === "left" ? -25 : 16;
  g.fillStyle(COLORS.botMetal, 1);
  g.fillRoundedRect(x, -4, 9, 14, 4);
  g.lineStyle(1.5, COLORS.botMetalDark, 1);
  g.strokeRoundedRect(x, -4, 9, 14, 4);
}

export function drawAntenna(g: Phaser.GameObjects.Graphics): void {
  roundLine(g, 0, -17, 3, -28, 2.5, COLORS.botMetalDark);
  g.fillStyle(COLORS.antennaTip, 1);
  g.fillCircle(3.5, -31, 3.5);
  g.lineStyle(1, COLORS.botMetalDark, 1);
  g.strokeCircle(3.5, -31, 3.5);
}

export function drawBody(g: Phaser.GameObjects.Graphics, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, 18);
  g.lineStyle(2, COLORS.botOutline, 0.45);
  g.strokeCircle(0, 0, 18);

  // Glossy highlight.
  g.lineStyle(3, 0xffffff, 0.55);
  g.beginPath();
  g.arc(0, 0, 13, Phaser.Math.DegToRad(-140), Phaser.Math.DegToRad(-75));
  g.strokePath();
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(-9.2, -9.4, 1.5);

  // Visor with two LED eyes.
  g.fillStyle(COLORS.botVisor, 1);
  g.fillRoundedRect(-12, -6, 24, 11, 5.5);
  g.fillStyle(COLORS.botEye, 1);
  g.fillCircle(-5, -0.5, 2.6);
  g.fillCircle(5, -0.5, 2.6);

  // Rivets.
  g.fillStyle(COLORS.botOutline, 0.5);
  g.fillCircle(-9, 10, 1.3);
  g.fillCircle(9, 10, 1.3);
}

/** Crack drawn on the shell once the bot has lost at least one part. */
export function drawCrack(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(1.3, COLORS.botOutline, 1);
  g.strokePoints(
    [new Phaser.Math.Vector2(5, -17), new Phaser.Math.Vector2(2, -12), new Phaser.Math.Vector2(7, -9), new Phaser.Math.Vector2(4, -6)],
    false,
  );
}

/** Extra crack on the flank of a wreck. */
export function drawWreckCrack(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(1.3, COLORS.botOutline, 1);
  g.strokePoints([new Phaser.Math.Vector2(-12, 4), new Phaser.Math.Vector2(-7, 9), new Phaser.Math.Vector2(-10, 13)], false);
}

export interface BotArtState {
  has: (part: PartId) => boolean;
  lostCount: number;
  isWreck: boolean;
}

/** Full bot, minus the parts it lost (z-order follows the mockups: wheel, arms, antenna, body, crack). */
export function drawBot(g: Phaser.GameObjects.Graphics, color: number, state: BotArtState): void {
  g.clear();
  if (state.has("wheel")) drawWheel(g);
  if (state.has("armLeft")) drawArm(g, "left");
  if (state.has("armRight")) drawArm(g, "right");
  if (state.has("antenna")) drawAntenna(g);
  drawBody(g, color);
  if (state.lostCount > 0) drawCrack(g);
  if (state.isWreck) drawWreckCrack(g);
}

/** Soft ground shadow, unrotated. */
export function drawBotShadow(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(3, 21, 38, 10);
}

/** Smoke puffs rising from a wreck; `t` is a free-running clock in seconds. */
export function drawSmoke(g: Phaser.GameObjects.Graphics, t: number): void {
  g.clear();
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.55 + i / 3) % 1;
    const radius = 3.5 + phase * 4.5;
    const x = 4 + Math.sin((t + i) * 2.1) * 3 + phase * 4;
    const y = -22 - phase * 24;
    g.fillStyle(COLORS.smoke, 0.55 * (1 - phase));
    g.fillCircle(x, y, radius);
  }
}

/** Mini spark star burst, used at impacts. */
export function drawSparks(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, alpha: number): void {
  fillSpark(g, x, y, size, COLORS.spark, alpha);
}
