/** Tournament content: which games exist, in which order, and how they are presented. */

export type GameId = "soccer" | "survivor" | "petanque";

/** Fixed tournament order (spec: Foot, Survivant, Pétanque). */
export const TOURNAMENT_ORDER: readonly GameId[] = ["soccer", "survivor", "petanque"];

/** Games that can actually be played right now. Add an id here when its mode ships. */
export const PLAYABLE_GAMES: readonly GameId[] = ["soccer"];

export interface GameInfo {
  name: string;
  /** Short rule reminder shown on ranking cards and in free play. */
  goal: string;
}

export const GAME_INFO: Record<GameId, GameInfo> = {
  soccer: { name: "Foot", goal: "Premier à 2 buts" },
  survivor: { name: "Survivant", goal: "Pousse-les dans la lave" },
  petanque: { name: "Pétanque", goal: "Premier à 3 points" },
};

/** Games a fresh tournament plays: the fixed order, minus games that are not implemented yet. */
export function defaultTournamentGames(): GameId[] {
  return TOURNAMENT_ORDER.filter((g) => PLAYABLE_GAMES.includes(g));
}
