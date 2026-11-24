/** Bowling: two lanes, one per team, each with its own ten pins. */

export const FRAMES = 5;
export const THROWS_PER_FRAME = 2;
export const SHOT_SPEED_SCALE = 1.8;
/** Pause after a frame, to show what fell. */
export const FRAME_PAUSE_MS = 2400;

export const PIN_COUNT = 10;
export const PIN_RADIUS = 16;
export const PIN_SPACING = 42;
export const PIN_PHYSICS = { restitution: 0.55, friction: 0.04, frictionAir: 0.055, density: 0.0016 };
/** A pin that ended further than this from its spot counts as knocked down. */
export const KNOCKED_DISTANCE = 20;

/** The whole building: lanes from the top to the bottom edge, approach on the left, pit on the right. */
export const HALL = { left: 150, right: 1440, top: 138, bottom: 862 } as const;
export const LANE_HEIGHT = 340;
/** Between the two lanes: ball return and divider. */
export const DIVIDER = 44;
export const LANE_CENTER = {
  red: HALL.top + LANE_HEIGHT / 2,
  yellow: HALL.bottom - LANE_HEIGHT / 2,
} as const;
/** Half the width of the wooden part; beyond it is the gutter. */
export const LANE_HALF = 128;
/** A ball whose centre goes past this is in the gutter. */
export const GUTTER_EDGE = LANE_HALF + 8;
export const GUTTER_OFFSET = LANE_HALF + 22;

export const START_X = 262;
export const FOUL_LINE_X = 360;
export const HEAD_PIN_X = 1130;
export const WALL_RESTITUTION = 0.5;
