/**
 * Twist 2 — the ball is an alarm clock that runs away. Every knob of its behavior lives here.
 */

export type PanicLevel = 0 | 1 | 2 | 3;

export interface PanicLevelConfig {
  id: PanicLevel;
  label: string;
  /** First turn (1-based) of this level. */
  fromTurn: number;
  /** Continuous flee force, as an acceleration in px/step² (scaled by the body's mass). */
  fleeAccel: number;
  /** Ring cadence in ms (SFX + vibration visuals). */
  ringPeriodMs: number;
  /** Visual tremble amplitude, px. */
  shake: number;
  /** Hand rotation speed, rad/s. */
  handSpeed: number;
}

export const PANIC_LEVELS: readonly PanicLevelConfig[] = [
  { id: 0, label: "Somnolent", fromTurn: 1, fleeAccel: 0.012, ringPeriodMs: 1100, shake: 0, handSpeed: 0.5 },
  { id: 1, label: "Réveillé", fromTurn: 4, fleeAccel: 0.03, ringPeriodMs: 700, shake: 0.4, handSpeed: 1.6 },
  { id: 2, label: "Inquiet", fromTurn: 7, fleeAccel: 0.055, ringPeriodMs: 420, shake: 1.6, handSpeed: 4 },
  { id: 3, label: "Panique", fromTurn: 11, fleeAccel: 0.085, ringPeriodMs: 240, shake: 3.2, handSpeed: 11 },
];

export const ALARM = {
  /** How long the clock propels itself during a resolution phase. */
  runDurationMs: 2500,
  /** The flee direction is re-evaluated this often. */
  steerPeriodMs: 200,
  /** Random angle added to the flee direction, ± degrees. */
  fleeJitterDeg: 28,
  /** Within this distance of a wall the clock slides along it instead of charging into it. */
  wallFollowDistance: 90,
  /** Fraction of the flee direction that points away from the wall while following it. */
  wallPushOut: 0.35,
  /** If slower than this (px/step) for `stuckAfterMs` while running, it heads for the pitch center. */
  stuckSpeed: 0.25,
  stuckAfterMs: 450,

  /** Stun: a bot hitting the clock harder than this (relative px/step) makes it stop for `stunMs`. */
  stunImpactSpeed: 11,
  stunMs: 1500,

  /** Lose this many panic levels after a goal (0 = off). */
  panicDropOnGoal: 1,

  restitution: 0.85,
  friction: 0.02,
  frictionAir: 0.02,
  density: 0.0016,
} as const;
