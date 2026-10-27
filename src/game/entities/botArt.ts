import Phaser from "phaser";
import { shade } from "@/game/util/color";

export type BotRole = "defender" | "attacker" | "support";

/**
 * Draws a bot centered on a Graphics object's local (0,0): glossy gradient
 * body, rim glow, specular highlight, a glowing visor "eye", an antenna, and
 * a role-specific accent (defender/attacker/support look visibly different).
 * Shared by the in-game Bot entity and the menu's mascot art so both stay
 * visually identical — see Bot.ts.
 */
export function drawBotIcon(
  g: Phaser.GameObjects.Graphics,
  color: number,
  radius: number,
  facing: 1 | -1 = 1,
  role: BotRole = "support",
): void {
  g.clear();

  const light = shade(color, 48);
  const dark = shade(color, -55);
  const rim = shade(color, 70);

  // Soft outer glow (reads well against a dark background).
  g.fillStyle(color, 0.16);
  g.fillCircle(0, 0, radius * 1.2);

  // Glossy gradient body.
  g.fillGradientStyle(light, light, dark, dark, 1, 1, 1, 1);
  g.fillCircle(0, 0, radius);
  g.lineStyle(Math.max(2, radius * 0.07), rim, 0.55);
  g.strokeCircle(0, 0, radius);

  if (role === "defender") drawDefenderAccent(g, color, radius, facing);
  if (role === "attacker") drawAttackerAccent(g, color, radius, facing);

  // Specular highlight.
  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(-radius * 0.32, -radius * 0.36, radius * 0.6, radius * 0.38);

  // Side vents (subtle tech detail).
  g.lineStyle(Math.max(2, radius * 0.09), 0x0b1220, 0.32);
  g.beginPath();
  g.arc(0, 0, radius * 0.88, Phaser.Math.DegToRad(198), Phaser.Math.DegToRad(252));
  g.strokePath();
  g.beginPath();
  g.arc(0, 0, radius * 0.88, Phaser.Math.DegToRad(-18), Phaser.Math.DegToRad(36));
  g.strokePath();

  // Visor.
  const visorCx = facing * radius * 0.08;
  const visorW = radius * 1.06;
  const visorH = radius * 0.6;
  g.fillStyle(0x0b1220, 0.94);
  g.fillRoundedRect(visorCx - visorW / 2, -visorH / 2, visorW, visorH, visorH * 0.42);
  g.lineStyle(Math.max(1, radius * 0.04), 0x38bdf8, 0.4);
  g.strokeRoundedRect(visorCx - visorW / 2, -visorH / 2, visorW, visorH, visorH * 0.42);

  // Eye LED with soft glow + tiny specular dot.
  const eyeX = visorCx + facing * radius * 0.32;
  g.fillStyle(0x7dd3fc, 0.35);
  g.fillCircle(eyeX, 0, radius * 0.26);
  g.fillStyle(0x7dd3fc, 1);
  g.fillCircle(eyeX, 0, radius * 0.14);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(eyeX - radius * 0.04, -radius * 0.04, radius * 0.045);

  // Antenna.
  const tipY = -radius - radius * 0.32;
  g.lineStyle(Math.max(2, radius * 0.07), 0x0b1220, 0.7);
  g.lineBetween(0, -radius, 0, tipY);
  g.fillStyle(color, 0.3);
  g.fillCircle(0, tipY, radius * 0.17);
  g.fillStyle(0xf8fafc, 1);
  g.fillCircle(0, tipY, radius * 0.1);

  if (role === "support") drawSupportAccent(g, eyeX, radius);
}

/** Bulkier "tank" look: reinforced rim + a shield-chevron plate on the back. */
function drawDefenderAccent(g: Phaser.GameObjects.Graphics, color: number, radius: number, facing: 1 | -1): void {
  g.lineStyle(Math.max(3, radius * 0.13), shade(color, -75), 0.85);
  g.strokeCircle(0, 0, radius * 0.99);

  const backBaseX = -facing * radius * 0.5;
  const backTipX = -facing * radius * 0.95;
  g.fillStyle(shade(color, -55), 0.95);
  g.fillTriangle(backBaseX, -radius * 0.55, backBaseX, radius * 0.55, backTipX, 0);
  g.lineStyle(Math.max(1, radius * 0.035), shade(color, 60), 0.5);
  g.strokeTriangle(backBaseX, -radius * 0.55, backBaseX, radius * 0.55, backTipX, 0);
}

/** Sleek "racer" look: a bright nose chevron at the front + swept fins at the back. */
function drawAttackerAccent(g: Phaser.GameObjects.Graphics, color: number, radius: number, facing: 1 | -1): void {
  const noseBaseX = facing * radius * 0.7;
  const noseTipX = facing * radius * 1.1;
  g.fillStyle(shade(color, 55), 0.95);
  g.fillTriangle(noseBaseX, -radius * 0.24, noseBaseX, radius * 0.24, noseTipX, 0);

  const backX = -facing * radius * 0.55;
  const finTipX = -facing * radius * 1.05;
  g.fillStyle(shade(color, -35), 0.9);
  g.fillTriangle(backX, -radius * 0.35, backX, -radius * 0.75, finTipX, -radius * 0.55);
  g.fillTriangle(backX, radius * 0.35, backX, radius * 0.75, finTipX, radius * 0.55);
}

/** "Scanner" look: a radar ring around the eye, a second antenna, and small side sensors. */
function drawSupportAccent(g: Phaser.GameObjects.Graphics, eyeX: number, radius: number): void {
  g.lineStyle(Math.max(1, radius * 0.045), 0x7dd3fc, 0.45);
  g.strokeCircle(eyeX, 0, radius * 0.38);

  const sideX = -radius * 0.38;
  const tipY = -radius - radius * 0.22;
  g.lineStyle(Math.max(1.5, radius * 0.055), 0x0b1220, 0.65);
  g.lineBetween(sideX, -radius * 0.82, sideX, tipY);
  g.fillStyle(0xf8fafc, 1);
  g.fillCircle(sideX, tipY, radius * 0.07);

  g.fillStyle(0x7dd3fc, 0.6);
  g.fillCircle(-radius * 0.6, -radius * 0.12, radius * 0.06);
  g.fillCircle(-radius * 0.6, radius * 0.12, radius * 0.06);
}

/** Role assigned by kickoff formation index — mirrors AIController's role assumptions. */
export function roleForIndex(index: number): BotRole {
  if (index === 0) return "defender";
  if (index === 1) return "attacker";
  return "support";
}
