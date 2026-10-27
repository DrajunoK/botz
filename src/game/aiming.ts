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
