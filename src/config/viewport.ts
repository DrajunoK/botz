import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";

/**
 * The game is designed on a GAME_WIDTH × GAME_HEIGHT "design area" (everything gameplay-related
 * lives there). On wider screens the canvas grows horizontally, keeping the design area centred,
 * so backdrops (stands, dim overlays…) are painted over the whole "world" below instead of
 * leaving bars on the sides.
 */

/** Widest screen we extend the backdrop for (21:9). Anything wider gets side bars. */
export const MAX_ASPECT = 21 / 9;

export const MAX_GAME_WIDTH = Math.round(GAME_HEIGHT * MAX_ASPECT);

/** Left edge (in design coordinates) of the widest possible visible area. Negative. */
export const WORLD_LEFT = (GAME_WIDTH - MAX_GAME_WIDTH) / 2;
export const WORLD_WIDTH = MAX_GAME_WIDTH;

/** Logical canvas width for a screen of the given aspect ratio (width / height). */
export function gameWidthForAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return GAME_WIDTH;
  const width = Math.round(GAME_HEIGHT * aspect);
  return Math.min(MAX_GAME_WIDTH, Math.max(GAME_WIDTH, width));
}
