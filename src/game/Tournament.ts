import { OPPOSITE_TEAM, TeamId } from "@/config/game";
import { PartId } from "@/config/parts";
import { GameId, defaultTournamentGames } from "@/config/tournament";
import { Rng } from "@/game/Rng";
import { newSeed } from "@/game/MatchConfig";
import { newId } from "@/state/id";

export interface GameResult {
  game: GameId;
  winner: TeamId;
  /** Final score of that game, in the game's own unit (goals, points, ...). */
  score: Record<TeamId, number>;
}

export interface TournamentOptions {
  /** Explicit schedule; when absent, games are drawn at random with `rng`. */
  games?: readonly GameId[];
  /** Source of the random draw (defaults to a fresh seed). */
  rng?: Rng;
  /** Restore every lost part in the workshop between two games. */
  repairBetweenGames?: boolean;
}

/** Parts still attached at the end of a game, keyed by `${team}-${botIndex}`. */
export type PartsSnapshot = Record<string, PartId[]>;

export const botKey = (team: TeamId, index: number): string => `${team}-${index}`;

/**
 * Ordered series of games. Every game is always played, even at 2–0: each win is worth one
 * trophy and the most trophies wins the tournament. Pure logic, no Phaser.
 */
export class Tournament {
  /** Identifies this tournament in the stats (its games point back to it). */
  readonly id = newId();
  readonly games: readonly GameId[];
  readonly repairBetweenGames: boolean;
  private readonly played: GameResult[] = [];
  private carried: PartsSnapshot = {};

  constructor(options: TournamentOptions = {}) {
    this.games = options.games ?? defaultTournamentGames(options.rng ?? new Rng(newSeed()));
    this.repairBetweenGames = options.repairBetweenGames ?? true;
    if (this.games.length === 0) throw new Error("A tournament needs at least one game");
  }

  get results(): readonly GameResult[] {
    return this.played;
  }

  get trophies(): Record<TeamId, number> {
    const t: Record<TeamId, number> = { red: 0, yellow: 0 };
    for (const r of this.played) t[r.winner] += 1;
    return t;
  }

  get isOver(): boolean {
    return this.played.length >= this.games.length;
  }

  /** 0-based index of the game being played (or about to be). */
  get gameIndex(): number {
    return this.played.length;
  }

  get currentGame(): GameId | null {
    return this.games[this.played.length] ?? null;
  }

  /** Team ahead on trophies right now, or null when level. */
  get leader(): TeamId | null {
    const { red, yellow } = this.trophies;
    if (red === yellow) return null;
    return red > yellow ? "red" : "yellow";
  }

  /** Winner once over; null while running (or level, only possible with an even game count). */
  get winner(): TeamId | null {
    return this.isOver ? this.leader : null;
  }

  /** Records the game just played and stores the parts the botz kept. */
  record(result: GameResult, partsAfter: PartsSnapshot = {}): void {
    if (this.isOver) throw new Error("Tournament is already over");
    if (result.game !== this.currentGame) throw new Error(`Expected ${this.currentGame}, got ${result.game}`);
    if (result.score[result.winner] <= result.score[OPPOSITE_TEAM[result.winner]]) {
      throw new Error("Winner must have the higher score");
    }
    this.played.push(result);
    this.carried = this.repairBetweenGames ? {} : partsAfter;
  }

  /** Parts a bot starts the next game with, or null for a fully repaired bot. */
  startingParts(team: TeamId, index: number): PartId[] | null {
    return this.carried[botKey(team, index)] ?? null;
  }
}
