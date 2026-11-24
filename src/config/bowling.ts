/** Bowling: two lanes, one per team, each with its own ten pins. */

export const FRAMES = 6;
export const SHOT_SPEED_SCALE = 2.1;
/** Pause after a frame, to show what fell. */
export const FRAME_PAUSE_MS = 1800;

export const PIN_COUNT = 10;
export const PIN_RADIUS = 16;
export const PIN_SPACING = 42;
export const PIN_PHYSICS = { restitution: 0.4, friction: 0.05, frictionAir: 0.06, density: 0.0026 };
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

/** One pin per frame is golden (worth this many points); it is the same pin on both lanes. */
export const GOLD_PIN_VALUE = 3;

/** Bumpers: round posts that stand in the lane for one frame, at the same spots on both lanes. */
export const BUMPER_RADIUS = 24;
export const BUMPERS_PER_FRAME = 2;
export const BUMPER_X_MIN = 520;
export const BUMPER_X_MAX = 940;
/** Distance from the lane's centre line, at least and at most. */
export const BUMPER_OFFSET_MIN = 62;
export const BUMPER_OFFSET_MAX = 104;

/** The lane tilts a little each frame: balls drift sideways by `DRIFT_STEP * level` px/step per step (level 1 to 3, either way). */
export const DRIFT_STEP = 0.05;
export const DRIFT_LEVELS = 3;
