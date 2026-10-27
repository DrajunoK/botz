/**
 * Central tuning file for the Matter.js physics simulation.
 * Keep every "feel" knob here so the game can be rebalanced without touching gameplay code.
 */

/** Fixed physics step, in ms. Using a fixed step keeps simulation reproducible
 * across devices — important for a future online mode that only syncs shot vectors. */
export const FIXED_TIMESTEP_MS = 1000 / 60;

/** Matter.js world gravity. Top-down game, so no gravity. */
export const GRAVITY = { x: 0, y: 0 };

export const BOT_RADIUS = 34;
export const BALL_RADIUS = 18;

export const BOT_PHYSICS = {
  restitution: 0.7,
  friction: 0.05,
  frictionAir: 0.035,
  density: 0.004,
};

export const BALL_PHYSICS = {
  restitution: 0.85,
  friction: 0.02,
  frictionAir: 0.02,
  density: 0.0015,
};

export const WALL_PHYSICS = {
  restitution: 0.9,
  friction: 0.02,
};

/** Max drag distance (px) used to aim; also the radius of the aim-range circle drawn around a selected bot. */
export const MAX_AIM_DISTANCE = 180;

/** Impulse (in Matter.js velocity units) applied at max drag distance. Scales linearly below that. */
export const MAX_SHOT_SPEED = 22;

/** Minimum drag distance (px) before a shot is registered at all — filters out accidental taps. */
export const MIN_AIM_DISTANCE = 12;
