/** Survivant: tuning of the round catwalk above the lava. */
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";

export const PLATFORM_CENTER = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };

/** Radius of the catwalk at the start of a game (logical units). */
export const PLATFORM_RADIUS = 330;

/** The catwalk shrinks at the start of every `SHRINK_EVERY_TURNS`-th turn (turns 4, 7, 10...). */
export const SHRINK_EVERY_TURNS = 3;
export const SHRINK_FACTOR = 0.88;
/** It never gets smaller than this share of its initial radius. */
export const MIN_RADIUS_RATIO = 0.4;
export const SHRINK_ANIM_MS = 700;

/** A bot that left the catwalk shrinks away over this long. */
export const FALL_MS = 300;
