/** Curling: tuning of the ice sheet, the target ("maison") and the scoring. */

export const POINTS_TO_WIN = 5;

/** Same as Pétanque: the strongest throw has to reach the target from the throwing circle. */
export const SHOT_SPEED_SCALE = 1.8;

export const MEASURE_MS = 2200;

/** Playable ice (inside the boards). */
export const ICE = { left: 190, right: 1410, top: 190, bottom: 710 } as const;
export const BOARD_THICKNESS = 22;
export const BOARD_RESTITUTION = 0.35;

/** Throwing circles, one per team, on the left. */
export const CIRCLE_RADIUS = 58;
export const CIRCLE_CENTER = {
  red: { x: ICE.left + 110, y: 350 },
  yellow: { x: ICE.left + 110, y: 550 },
} as const;

/** The target: a bot only scores when its centre is inside the outer ring. */
export const HOUSE_CENTER = { x: 1110, y: 450 } as const;
export const HOUSE_RADIUS = 200;
/** Ring radii from the outside in (blue, white, red, button), as painted. */
export const HOUSE_RINGS = [200, 135, 70, 22] as const;
