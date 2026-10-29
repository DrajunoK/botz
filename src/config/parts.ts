/**
 * Twist 1 — botz fall apart. Every knob of the part-loss system lives here.
 */

export type PartId = "antenna" | "armLeft" | "armRight" | "wheel";

export const ALL_PARTS: readonly PartId[] = ["antenna", "armLeft", "armRight", "wheel"];

export const PARTS = {
  /** Relative speed (px/step along the collision normal) above which a bot–bot / bot–wall hit can knock a part off. */
  impactSpeedThreshold: 14,
  /** A bot cannot lose two parts within this window. */
  lossCooldownMs: 300,

  /** Each lost part removes this fraction of the bot's original mass. */
  massLossPerPart: 0.14,
  /** Lighter bots leave faster for the same arrow: speed multiplier gained per lost part. */
  shotSpeedBonusPerPart: 0.07,

  /** Missing antenna: random aim error, ± this many degrees. */
  antennaNoiseDeg: 10,
  /** Missing arm: heading rotation rate (rad/s) while moving. Left arm missing curves right, right arm curves left. */
  armDriftRadPerSec: 0.55,
  /** Drift only applies while the bot is faster than this (px/step), so a parked bot doesn't spin its velocity. */
  driftMinSpeed: 0.6,

  /** Missing wheel: air friction multiplier range, re-rolled every `wheelDragPeriodMs`. */
  wheelDragMin: 0.6,
  wheelDragMax: 3.4,
  wheelDragPeriodMs: 180,
  /** Missing wheel: visual spin, in rad/s per px/step of speed. */
  wheelSpinPerSpeed: 1.6,

  /** Wrecks (no part left) get an extra aim error on top of the missing antenna's. */
  wreckExtraNoiseDeg: 12,
} as const;

export const DEBRIS = {
  /** Oldest debris fades out beyond this many pieces. */
  maxCount: 12,
  fadeOutMs: 500,
  /** Launch speed of a freshly detached part (px/step). */
  launchSpeedMin: 3,
  launchSpeedMax: 7,
  restitution: 0.55,
  frictionAir: 0.045,
  density: 0.0012,
  /** Wipe debris at kickoff after a goal? Default: they stay. */
  clearOnGoal: false,
} as const;

/** Repair every botz at kickoff after a goal? Default: parts stay lost for the whole match. */
export const REPAIR_ON_GOAL = false;
