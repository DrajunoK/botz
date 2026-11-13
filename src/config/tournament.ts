/** Tournament content: which games exist, how they are presented, and how a tournament is drawn. */
import type { Rng } from "@/game/Rng";

export type GameId = "soccer" | "survivor" | "petanque";

/** Every game the project knows about, in menu order. Future mini-games get added here. */
export const ALL_GAMES: readonly GameId[] = ["soccer", "survivor", "petanque"];

/** Games that can actually be played right now. Add an id here when its mode ships. */
export const PLAYABLE_GAMES: readonly GameId[] = ["soccer", "survivor", "petanque"];

/** How many games a tournament plays, drawn at random (in random order) from the playable ones. */
export const TOURNAMENT_SIZE = 3;

export interface GameInfo {
  name: string;
  /** Short rule reminder shown on ranking cards and in the single-game picker. */
  goal: string;
}

export const GAME_INFO: Record<GameId, GameInfo> = {
  soccer: { name: "Foot", goal: "Premier à 2 buts" },
  survivor: { name: "Survivant", goal: "Pousse-les dans la lave" },
  petanque: { name: "Pétanque", goal: "Premier à 3 points" },
};

/** Games a fresh tournament plays: a random draw of the playable games, in random order. */
export function defaultTournamentGames(rng: Rng, pool: readonly GameId[] = PLAYABLE_GAMES): GameId[] {
  return rng.shuffle(pool).slice(0, TOURNAMENT_SIZE);
}
