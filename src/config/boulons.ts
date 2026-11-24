/** Chasse aux boulons: a workshop floor strewn with bolts, one deposit zone per team. */

export const TURNS = 10;
export const GOLD_VALUE = 2;

export const ARENA = { left: 130, right: 1470, top: 150, bottom: 850 } as const;
/** The arena is symmetric about this x, so every bolt has a twin on the other side. */
export const MIRROR_X = (ARENA.left + ARENA.right) / 2;
export const mirrorX = (x: number): number => 2 * MIRROR_X - x;

/** One pit per team, against its own short wall: a bolt that falls in scores for the team that owns it. */
export const PIT = {
  red: { x: ARENA.left + 130, y: 500, r: 100 },
  yellow: { x: ARENA.right - 130, y: 500, r: 100 },
} as const;
/** How far inside the rim the centre of a body must be before it falls in. */
export const BOLT_FALL_MARGIN = 0;
export const BOT_FALL_MARGIN = 24;
export const BOMB_FALL_MARGIN = 8;
/** Bolts piled in a pit are drawn inside this radius. */
export const PILE_RADIUS = 76;
export const PILE_MAX = 26;

/** The bomb: pushed into a pit it explodes, throwing the bolts of that pit back out and shoving what is near. */
export const BOMB_RADIUS = 22;
export const BOMB_PHYSICS = { restitution: 0.5, friction: 0.04, frictionAir: 0.05, density: 0.004 };
export const BOMB_RETURN_TURNS = 2;
export const BLAST_RADIUS = 260;
export const BLAST_PUSH = 9;
export const EJECT_SPEED_MIN = 6;
export const EJECT_SPEED_MAX = 13;
/** Where the golden bolt and the bomb appear (symmetric between the two teams). */
export const GOLD_SPOT = { x: MIRROR_X, y: 330 } as const;
export const BOMB_SPOT = { x: MIRROR_X, y: 670 } as const;

export const BOLT_RADIUS = 15;
export const GOLD_RADIUS = 20;
export const BOLT_PHYSICS = { restitution: 0.5, friction: 0.04, frictionAir: 0.035, density: 0.003 };
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
