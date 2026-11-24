/** Tournament content: which games exist, how they are presented, and how a tournament is drawn. */
import type { Rng } from "@/game/Rng";

export type GameId = "soccer" | "survivor" | "petanque" | "curling" | "bowling" | "boulons";

/** Every game the project knows about, in menu order. Future mini-games get added here. */
export const ALL_GAMES: readonly GameId[] = ["soccer", "survivor", "petanque", "curling", "bowling", "boulons"];

/** Games that can actually be played right now. Add an id here when its mode ships. */
export const PLAYABLE_GAMES: readonly GameId[] = ["soccer", "survivor", "petanque", "curling", "bowling", "boulons"];

/** How many games a tournament plays, drawn at random (in random order) from the playable ones. */
export const TOURNAMENT_SIZE = 3;

export interface GameInfo {
  name: string;
  /** Short name for tight spots (filter buttons). */
  short: string;
  /** Short rule reminder shown on ranking cards and in the single-game picker. */
  goal: string;
}

export const GAME_INFO: Record<GameId, GameInfo> = {
  soccer: { name: "Foot", short: "Foot", goal: "Premier à 2 buts" },
  survivor: { name: "Survivant", short: "Survivant", goal: "Pousse-les dans la lave" },
  petanque: { name: "Pétanque", short: "Pétanque", goal: "Premier à 3 points" },
  curling: { name: "Curling", short: "Curling", goal: "Le plus près du centre marque · premier à 5" },
  bowling: { name: "Bowling", short: "Bowling", goal: "Le plus de quilles en 5 manches" },
  boulons: { name: "Chasse aux boulons", short: "Boulons", goal: "Pousse les boulons dans ton dépôt · doré = 2" },
};

/** Games a fresh tournament plays: a random draw of the playable games, in random order. */
export function defaultTournamentGames(rng: Rng, pool: readonly GameId[] = PLAYABLE_GAMES): GameId[] {
  return rng.shuffle(pool).slice(0, TOURNAMENT_SIZE);
}
