import { COLORS } from "@/config/theme";

/** Logical (design-time) resolution. Scaled to fit the actual screen. */
export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;

/** Number of botz per team. */
export const BOTZ_PER_TEAM = 3;

/** Goals needed to win a match. */
export const GOALS_TO_WIN = 2;

/** Aiming phase duration, in milliseconds. */
export const AIM_DURATION_MS = 15_000;

/** Safety cap on how long the resolution (physics settling) phase can run. */
export const RESOLVE_MAX_DURATION_MS = 7_000;

/** Below this speed (px/step, over every dynamic body), bodies are considered "settled". */
export const SETTLE_SPEED_THRESHOLD = 0.5;

/** Consecutive fixed-step ticks under the threshold before we call it settled. */
export const SETTLE_STABLE_TICKS = 30;

export const TEAM_COLORS = {
  red: COLORS.red,
  yellow: COLORS.yellow,
} as const;

export type TeamId = "red" | "yellow";

export const OPPOSITE_TEAM: Record<TeamId, TeamId> = {
  red: "yellow",
  yellow: "red",
};

export const TEAM_LABEL: Record<TeamId, string> = {
  red: "ROUGE",
  yellow: "JAUNE",
};

export type Difficulty = "easy" | "normal" | "hard";
