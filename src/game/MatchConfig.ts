import { Difficulty, TeamId } from "@/config/game";
import { GameId } from "@/config/tournament";
import type { Tournament } from "@/game/Tournament";

export type MatchMode = "solo" | "passPlay";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Facile", normal: "Normal", hard: "Difficile" };

export interface MatchConfig {
  mode: MatchMode;
  difficulty: Difficulty;
  /** Seed of the match's random generator: same seed + same inputs = same match. */
  seed: number;
  /** Game to play now. */
  gameId: GameId;
  /** Present when this game is part of a tournament; absent in free play. */
  tournament?: Tournament;
}

/** Fresh seed for a new match (wall-clock based: this is the one place entropy enters). */
export function newSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

/** Who is behind each team, as shown on the ranking screen. */
export function playerName(config: Pick<MatchConfig, "mode" | "difficulty">, team: TeamId): string {
  if (config.mode === "passPlay") return team === "red" ? "Joueur 1" : "Joueur 2";
  return team === "red" ? "Joueur 1" : `Ordi · ${DIFFICULTY_LABEL[config.difficulty]}`;
}
