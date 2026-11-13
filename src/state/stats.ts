import { TeamId } from "@/config/game";
import { GameId } from "@/config/tournament";
import { newId } from "@/state/id";

const STORAGE_KEY = "botz.stats.v1";
/** Already-uploaded records beyond this many are dropped from the phone (the cloud keeps them). */
const KEEP_SYNCED = 300;

/** Mirrors the `mode` / `context` / `result` check constraints of supabase/schema.sql. */
export type StatsMode = "vs_ai" | "local_2p";
export type StatsContext = "single" | "tournament";
export type Outcome = "win" | "loss" | "draw";

export interface MatchRecord {
  id: string;
  game: GameId;
  mode: StatsMode;
  context: StatsContext;
  tournamentId?: string;
  result: Outcome;
  scoreFor: number;
  scoreAgainst: number;
  /** ISO timestamp. */
  playedAt: string;
  synced: boolean;
}

export interface TournamentRecord {
  id: string;
  mode: StatsMode;
  result: Outcome;
  playedAt: string;
  synced: boolean;
}

export interface Tally {
  wins: number;
  losses: number;
  draws: number;
}

export interface GameTally {
  single: Tally;
  tournament: Tally;
  total: Tally;
}

export interface StatsSummary {
  games: Record<GameId, GameTally>;
  tournaments: Tally;
}

interface StoredData {
  matches: MatchRecord[];
  tournaments: TournamentRecord[];
}

/** The slice of `localStorage` the store needs, so tests can pass an in-memory one. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const emptyTally = (): Tally => ({ wins: 0, losses: 0, draws: 0 });

function add(tally: Tally, result: Outcome): void {
  if (result === "win") tally.wins += 1;
  else if (result === "loss") tally.losses += 1;
  else tally.draws += 1;
}

/** Match mode as stored for stats: a pass-and-play game has no "own" side worth ranking. */
export const statsMode = (mode: "solo" | "passPlay"): StatsMode => (mode === "solo" ? "vs_ai" : "local_2p");

/** The player is always the red team (player 1). */
export const outcomeFor = (winner: TeamId | null): Outcome => (winner === null ? "draw" : winner === "red" ? "win" : "loss");

/** Wins / losses by game and by tournament, counting only games played against the computer. */
export function summarize(matches: readonly MatchRecord[], tournaments: readonly TournamentRecord[], games: readonly GameId[]): StatsSummary {
  const summary: StatsSummary = { games: {} as Record<GameId, GameTally>, tournaments: emptyTally() };
  for (const g of games) summary.games[g] = { single: emptyTally(), tournament: emptyTally(), total: emptyTally() };
  for (const m of matches) {
    if (m.mode !== "vs_ai") continue;
    const tally = summary.games[m.game];
    if (!tally) continue;
    add(tally[m.context], m.result);
    add(tally.total, m.result);
  }
  for (const t of tournaments) if (t.mode === "vs_ai") add(summary.tournaments, t.result);
  return summary;
}

/**
 * Every finished game and tournament, kept on the phone. Records are written here first (works
 * offline) and uploaded later; `synced` marks the ones the cloud already has.
 */
export class StatsStore {
  private data: StoredData;

  constructor(private readonly storage: KeyValueStorage | null) {
    this.data = this.load();
  }

  get matches(): readonly MatchRecord[] {
    return this.data.matches;
  }

  get tournaments(): readonly TournamentRecord[] {
    return this.data.tournaments;
  }

  recordGame(game: {
    game: GameId;
    mode: StatsMode;
    tournamentId?: string;
    winner: TeamId;
    score: Record<TeamId, number>;
  }): MatchRecord {
    const record: MatchRecord = {
      id: newId(),
      game: game.game,
      mode: game.mode,
      context: game.tournamentId ? "tournament" : "single",
      tournamentId: game.tournamentId,
      result: outcomeFor(game.winner),
      scoreFor: game.score.red,
      scoreAgainst: game.score.yellow,
      playedAt: new Date().toISOString(),
      synced: false,
    };
    this.data.matches.push(record);
    this.save();
    return record;
  }

  recordTournament(tournament: { id: string; mode: StatsMode; winner: TeamId | null }): TournamentRecord {
    const record: TournamentRecord = {
      id: tournament.id,
      mode: tournament.mode,
      result: outcomeFor(tournament.winner),
      playedAt: new Date().toISOString(),
      synced: false,
    };
    this.data.tournaments.push(record);
    this.save();
    return record;
  }

  /** Records the cloud has not acknowledged yet. */
  pending(): { matches: MatchRecord[]; tournaments: TournamentRecord[] } {
    return {
      matches: this.data.matches.filter((m) => !m.synced),
      tournaments: this.data.tournaments.filter((t) => !t.synced),
    };
  }

  markSynced(ids: readonly string[]): void {
    const done = new Set(ids);
    for (const m of this.data.matches) if (done.has(m.id)) m.synced = true;
    for (const t of this.data.tournaments) if (done.has(t.id)) t.synced = true;
    this.data.matches = trim(this.data.matches);
    this.data.tournaments = trim(this.data.tournaments);
    this.save();
  }

  private load(): StoredData {
    const empty: StoredData = { matches: [], tournaments: [] };
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<StoredData>;
      return {
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        tournaments: Array.isArray(parsed.tournaments) ? parsed.tournaments : [],
      };
    } catch {
      return empty;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable (private mode, quota): stats just won't survive a restart.
    }
  }
}

/** Keeps every unsynced record plus the newest KEEP_SYNCED synced ones. */
function trim<T extends { synced: boolean }>(records: T[]): T[] {
  const syncedCount = records.filter((r) => r.synced).length;
  let drop = Math.max(0, syncedCount - KEEP_SYNCED);
  return records.filter((r) => !(r.synced && drop-- > 0));
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const Stats = new StatsStore(browserStorage());
