import Phaser from "phaser";
import { COLORS } from "@/config/theme";
import { PanicLevel } from "@/config/alarmClock";
import { fillDrop, roundLine, strokeQuad } from "@/game/view/draw";

/** Alarm clock art, in the mockups' native units (face radius 16, case radius 22). */
export const CLOCK_ART_RADIUS = 22;

export function drawClockShadow(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(3, 27, 44, 10);
}

/** Case, bells, feet and dial (no hands, no face expression). */
function drawClockBase(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.botWheel, 1);
  g.fillEllipse(-11, 22, 14, 8);
  g.fillEllipse(11, 22, 14, 8);

  roundLine(g, 0, -21, 0, -30, 3, 0x5a4320);
  g.fillStyle(COLORS.clockBell, 1);
  g.fillCircle(0, -31, 3);
  g.lineStyle(1.5, COLORS.clockBellEdge, 1);
  g.strokeCircle(0, -31, 3);

  for (const bx of [-15, 15]) {
    g.fillStyle(COLORS.clockBell, 1);
    g.fillCircle(bx, -19, 9);
    g.lineStyle(2, COLORS.clockBellEdge, 1);
    g.strokeCircle(bx, -19, 9);
  }

  g.fillStyle(COLORS.clockBody, 1);
  g.fillCircle(0, 0, 22);
  g.lineStyle(2, COLORS.clockEdge, 1);
  g.strokeCircle(0, 0, 22);
  g.lineStyle(3, 0xffffff, 0.5);
  g.beginPath();
  g.arc(0, 0, 17, Phaser.Math.DegToRad(-148), Phaser.Math.DegToRad(-96));
  g.strokePath();

  g.fillStyle(COLORS.clockFace, 1);
  g.fillCircle(0, 0, 16);
  g.lineStyle(1.5, COLORS.clockEdge, 1);
  g.strokeCircle(0, 0, 16);

  const tick = (x0: number, y0: number, x1: number, y1: number) => roundLine(g, x0, y0, x1, y1, 2, COLORS.clockTick);
  tick(0, -14, 0, -11.5);
  tick(0, 14, 0, 11.5);
  tick(-14, 0, -11.5, 0);
  tick(14, 0, 11.5, 0);
}

function drawEyesAndMouth(g: Phaser.GameObjects.Graphics, level: PanicLevel, blink: boolean): void {
  const ink = COLORS.clockInk;
  switch (level) {
    case 0: // sleepy: closed arcs, flat mouth
      g.lineStyle(2, ink, 1);
      strokeQuad(g, -9, -3, -6, 0, -3, -3);
      strokeQuad(g, 3, -3, 6, 0, 9, -3);
      roundLine(g, -3, 7, 3, 7, 2, ink);
      break;
    case 1: // awake: round eyes, smile
      if (blink) {
        roundLine(g, -8, -3, -4, -3, 2, ink);
        roundLine(g, 4, -3, 8, -3, 2, ink);
      } else {
        g.fillStyle(ink, 1);
        g.fillCircle(-6, -3, 2.4);
        g.fillCircle(6, -3, 2.4);
      }
      g.lineStyle(2, ink, 1);
      strokeQuad(g, -5, 5, 0, 10, 5, 5);
      break;
    case 2: // worried: angled brows, wavy mouth
      roundLine(g, -10, -10, -3, -7, 2, ink);
      roundLine(g, 10, -10, 3, -7, 2, ink);
      g.fillStyle(ink, 1);
      g.fillCircle(-6, -2, 2.6);
      g.fillCircle(6, -2, 2.6);
      g.lineStyle(2, ink, 1);
      strokeQuad(g, -5, 7, -2.5, 4, 0, 7);
      strokeQuad(g, 0, 7, 2.5, 10, 5, 7);
      break;
    default: // panic: huge eyes, open mouth
      for (const ex of [-6, 6]) {
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(ex, -3, 10, 12);
        g.lineStyle(1.5, ink, 1);
        g.strokeEllipse(ex, -3, 10, 12);
        g.fillStyle(ink, 1);
        g.fillCircle(ex, -3, 1.8);
      }
      g.fillStyle(ink, 1);
      g.fillEllipse(0, 8.5, 7, 8);
  }
}

/** The two clock hands, drawn faint behind the face; the minute hand spins at `angle`, the hour hand at `angle / 12`. */
function drawHands(g: Phaser.GameObjects.Graphics, angle: number): void {
  const ink = COLORS.clockInk;
  const hx = Math.cos(angle / 12 - Math.PI / 2);
  const hy = Math.sin(angle / 12 - Math.PI / 2);
  const mx = Math.cos(angle - Math.PI / 2);
  const my = Math.sin(angle - Math.PI / 2);
  roundLine(g, 0, 0, hx * 8, hy * 8, 2, ink, 0.3);
  roundLine(g, 0, 0, mx * 12, my * 12, 1.4, ink, 0.3);
}

/** Vibration arcs around the clock, 1 pair at level 2, 2 pairs at level 3. */
function drawVibration(g: Phaser.GameObjects.Graphics, level: PanicLevel, wobble: number): void {
  if (level < 2) return;
  const w = wobble;
  g.lineStyle(2.2, COLORS.vibration, 1);
  strokeQuad(g, -31 - w, -12, -36 - w, 0, -31 - w, 12);
  strokeQuad(g, 31 + w, -12, 36 + w, 0, 31 + w, 12);
  if (level >= 3) {
    strokeQuad(g, -37 - w, -17, -44 - w, 0, -37 - w, 17);
    strokeQuad(g, 37 + w, -17, 44 + w, 0, 37 + w, 17);
  }
}

export interface ClockArtState {
  level: PanicLevel;
  /** Free-running clock, seconds. */
  time: number;
  /** Hand angle in radians. */
  handAngle: number;
  stunned: boolean;
  ringing: boolean;
}

/** Draws the whole clock, in native units, centered on (0, 0). */
export function drawAlarmClock(g: Phaser.GameObjects.Graphics, s: ClockArtState): void {
  g.clear();
  const wobble = Math.sin(s.time * 30) * 1.5;
  if (s.ringing) drawVibration(g, s.level, wobble);

  drawClockBase(g);

  if (s.stunned) {
    // Dizzy face: spiral-ish X eyes, wavy mouth.
    const ink = COLORS.clockInk;
    drawHands(g, s.handAngle);
    for (const ex of [-6, 6]) {
      roundLine(g, ex - 2.5, -5.5, ex + 2.5, -0.5, 1.8, ink);
      roundLine(g, ex + 2.5, -5.5, ex - 2.5, -0.5, 1.8, ink);
    }
    g.lineStyle(2, ink, 1);
    strokeQuad(g, -5, 8, -2.5, 5, 0, 8);
    strokeQuad(g, 0, 8, 2.5, 11, 5, 8);
    return;
  }

  drawHands(g, s.handAngle);
  drawEyesAndMouth(g, s.level, Math.sin(s.time * 1.7) > 0.985);

  // Sweat drops from level 2.
  if (s.level >= 2) fillDrop(g, 24, -9.5, 1, COLORS.sweat, COLORS.sweatEdge);
  if (s.level >= 3) fillDrop(g, -24, -9.5, 1, COLORS.sweat, COLORS.sweatEdge);
}

/** "z Z" bubbles above a sleeping clock. */
export function zzzOffsets(time: number): { x: number; y: number; size: number; alpha: number }[] {
  const out: { x: number; y: number; size: number; alpha: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const phase = (time * 0.35 + i * 0.5) % 1;
    out.push({ x: 22 + phase * 8 + i * 4, y: -28 - phase * 16, size: 9 + i * 3, alpha: 1 - phase });
  }
  return out;
}
