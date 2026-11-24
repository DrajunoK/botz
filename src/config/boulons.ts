/** Chasse aux boulons: a workshop floor strewn with bolts, one deposit zone per team. */

export const TURNS = 10;
export const GOLD_VALUE = 2;

export const ARENA = { left: 130, right: 1470, top: 150, bottom: 850 } as const;
/** The arena is symmetric about this x, so every bolt has a twin on the other side. */
export const MIRROR_X = (ARENA.left + ARENA.right) / 2;
export const mirrorX = (x: number): number => 2 * MIRROR_X - x;

/** Deposit zones against the short walls, where a bolt scores. */
export const ZONE = {
  red: { left: ARENA.left, right: ARENA.left + 200, top: 300, bottom: 700 },
  yellow: { left: ARENA.right - 200, right: ARENA.right, top: 300, bottom: 700 },
} as const;

export const BOLT_RADIUS = 15;
export const GOLD_RADIUS = 20;
export const BOLT_PHYSICS = { restitution: 0.5, friction: 0.04, frictionAir: 0.05, density: 0.003 };
/** Bolts and golden bolts that exist in total; the ones not on the floor wait to be dropped again. */
export const BOLT_POOL = 24;
export const GOLD_POOL = 2;
/** A fresh start drops this many mirrored pairs; a refill, fewer. */
export const START_PAIRS = 6;
export const REFILL_PAIRS = 3;
/** When fewer bolts than this are on the floor, more are dropped before the next turn. */
export const REFILL_BELOW = 5;

export const SPAWN_X = 420;
export const SPAWN_Y = [300, 450, 600] as const;

export const WALL_RESTITUTION = 0.6;
