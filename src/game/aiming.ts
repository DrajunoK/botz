import { MAX_AIM_DISTANCE, MAX_SHOT_SPEED, MIN_AIM_DISTANCE } from "@/config/physics";

export interface Vec2 {
  x: number;
  y: number;
}

export interface AimResult {
  /** Drag vector clamped to MAX_AIM_DISTANCE (used to draw the arrow). */
  clamped: Vec2;
  /** Unclamped drag length, in px. */
  rawDistance: number;
  /** Drag length after clamping, in px. */
  distance: number;
  /** Resulting shot velocity to apply to the physics body. */
  velocity: Vec2;
  /** True if the drag is long enough to count as a valid shot. */
  isValid: boolean;
}

/**
 * Converts a raw screen-space drag vector (from a bot's position to the
 * current pointer position) into a clamped aim arrow + shot velocity.
 *
 * The arrow (and the resulting shot) points in the SAME direction as the
 * drag, per spec: dragging from the bot towards the opponent goal shoots the
 * bot that way. Drag length sets power, clamped at MAX_AIM_DISTANCE.
 */
export function computeAim(dragX: number, dragY: number): AimResult {
  const rawDistance = Math.hypot(dragX, dragY);
  const distance = Math.min(rawDistance, MAX_AIM_DISTANCE);
  const isValid = rawDistance >= MIN_AIM_DISTANCE;

  if (rawDistance === 0) {
    return { clamped: { x: 0, y: 0 }, rawDistance, distance, velocity: { x: 0, y: 0 }, isValid };
  }

  const nx = dragX / rawDistance;
  const ny = dragY / rawDistance;
  const clamped: Vec2 = { x: nx * distance, y: ny * distance };
  const power = distance / MAX_AIM_DISTANCE;
  const velocity: Vec2 = { x: nx * power * MAX_SHOT_SPEED, y: ny * power * MAX_SHOT_SPEED };

  return { clamped, rawDistance, distance, velocity, isValid };
}

/** Number of chevrons at max power (the last one touches the range circle). */
export const AIM_CHEVRON_COUNT = 10;

/** Chevron count for a drag of `distance` px: max(1, round(power * 10)), power in 0..1. */
export function chevronCount(distance: number): number {
  const power = Math.min(1, Math.max(0, distance / MAX_AIM_DISTANCE));
  return Math.max(1, Math.round(power * AIM_CHEVRON_COUNT));
}

/** Spec geometry is authored for a bot of radius 18. */
const SPEC_BOT_RADIUS = 18;

/**
 * Outline of chevron `i` (0..9) in local coordinates: +x points along the shot, origin at the
 * bot's centre. Chevrons grow slowly from 3.5 to 8 half-height so the arrow stays thin.
 */
export function chevronPolygon(i: number, botRadius: number): Vec2[] {
  const s = botRadius / SPEC_BOT_RADIUS;
  const x = 26 + i * 10;
  const h = 3.5 + i * 0.5;
  const t = 7.5 + i * 0.2;
  const k = h;
  return [
    { x: x - k, y: -h },
    { x: x - k + t, y: -h },
    { x: x + t, y: 0 },
    { x: x - k + t, y: h },
    { x: x - k, y: h },
    { x, y: 0 },
  ].map((p) => ({ x: p.x * s, y: p.y * s }));
}

const GRADIENT: ReadonlyArray<readonly [number, number]> = [
  [0, 0x7fd1ae],
  [0.35, 0xc8e06a],
  [0.6, 0xf6c234],
  [0.8, 0xf28a3a],
  [1, 0xe8473f],
];

/** Fixed green-to-red gradient along the full range (spec x = 24..126), not the current arrow. */
export function chevronColor(i: number): number {
  const x = 26 + i * 10;
  const t = Math.min(1, Math.max(0, (x - 24) / (126 - 24)));
  for (let n = 1; n < GRADIENT.length; n++) {
    const [t1, c1] = GRADIENT[n];
    if (t <= t1) {
      const [t0, c0] = GRADIENT[n - 1];
      const f = (t - t0) / (t1 - t0);
      const lerp = (shift: number) => Math.round(((c0 >> shift) & 255) * (1 - f) + ((c1 >> shift) & 255) * f);
      return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
    }
  }
  return GRADIENT[GRADIENT.length - 1][1];
}
