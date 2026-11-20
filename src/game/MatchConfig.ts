import { Difficulty, TeamId } from "@/config/game";
import { GameId } from "@/config/tournament";
import type { Tournament } from "@/game/Tournament";
import type { SyncTestOptions } from "@/game/syncTest";
import type { OnlineSession } from "@/net/OnlineSession";

export type MatchMode = "solo" | "passPlay" | "online";

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
  /** Hidden determinism check (see syncTest.ts): AI plays both teams and each turn is hashed. */
  syncTest?: SyncTestOptions;
  /** Present in an online match: the link to the opponent's device (the session also says which team is ours). */
  online?: OnlineSession;
  /** Development: an online match whose local player is played by the AI (see net/localRoom.ts). */
  onlineAutoplay?: boolean;
  /** Development: the guest nudges its own world after turn 2 to exercise the host's repair. */
  onlineDrift?: boolean;
}

/** Fresh seed for a new match (wall-clock based: this is the one place entropy enters). */
export function newSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

/** Who is behind each team, as shown on the ranking screen. */
export function playerName(config: Pick<MatchConfig, "mode" | "difficulty">, team: TeamId): string {
  if (config.mode === "passPlay" || config.mode === "online") return team === "red" ? "Joueur 1" : "Joueur 2";
  return team === "red" ? "Joueur 1" : `Ordi · ${DIFFICULTY_LABEL[config.difficulty]}`;
}
