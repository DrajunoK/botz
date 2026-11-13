/** Pétanque: tuning of the gravel court, the throwing circles and the scoring. */
import { RoundedRect } from "@/game/field/fieldGeometry";

export const POINTS_TO_WIN = 3;

/**
 * Shots are scaled up in Pétanque so the strongest throw reaches the far end of the court
 * (the court is longer than the Foot-sized shot's glide). The aim arrow still shows 0–100 % power.
 */
export const SHOT_SPEED_SCALE = 1.8;

/** The jack stops quickly on gravel. */
export const JACK_FRICTION_AIR = 0.06;

/** How long the "On mesure !" animation runs before the next end starts. */
export const MEASURE_MS = 3200;

/** Wooden border of the court (outer edge) and the gravel inside it. */
export const WOOD_RECT: RoundedRect = { left: 190, right: 1410, top: 200, bottom: 700, radius: 40 };
export const WOOD_THICKNESS = 22;
export const PLAY_RECT = {
  left: WOOD_RECT.left + WOOD_THICKNESS,
  right: WOOD_RECT.right - WOOD_THICKNESS,
  top: WOOD_RECT.top + WOOD_THICKNESS,
  bottom: WOOD_RECT.bottom - WOOD_THICKNESS,
};

/** Bounciness of the wooden border (low: the gravel court is dead). */
export const WOOD_RESTITUTION = 0.3;

/** Throwing circles, one per team, on the left. */
export const CIRCLE_RADIUS = 58;
export const CIRCLE_CENTER = {
  red: { x: PLAY_RECT.left + 100, y: 345 },
  yellow: { x: PLAY_RECT.left + 100, y: 555 },
} as const;

/** The jack lands in the right two thirds of the court, never closer than this to a border. */
export const JACK_MARGIN = 90;
export const JACK_MIN_X = PLAY_RECT.left + (PLAY_RECT.right - PLAY_RECT.left) / 3;
