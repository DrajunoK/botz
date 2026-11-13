import { describe, expect, it } from "vitest";
import { KeyValueStorage, StatsStore, outcomeFor, statsMode, summarize } from "@/state/stats";
import { ALL_GAMES } from "@/config/tournament";
import { Tournament } from "@/game/Tournament";
import { newId } from "@/state/id";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const game = (winner: "red" | "yellow", extra: Partial<Parameters<StatsStore["recordGame"]>[0]> = {}) => ({
  game: "soccer" as const,
  mode: "vs_ai" as const,
  winner,
  score: winner === "red" ? { red: 2, yellow: 1 } : { red: 0, yellow: 2 },
  ...extra,
});

describe("StatsStore", () => {
  it("records a game from the red player's point of view", () => {
    const store = new StatsStore(memoryStorage());
    const won = store.recordGame(game("red"));
    const lost = store.recordGame(game("yellow"));
    expect(won).toMatchObject({ result: "win", scoreFor: 2, scoreAgainst: 1, context: "single", synced: false });
    expect(lost).toMatchObject({ result: "loss", scoreFor: 0, scoreAgainst: 2 });
  });

  it("marks a game as part of a tournament when it has a tournament id", () => {
    const store = new StatsStore(memoryStorage());
    expect(store.recordGame(game("red", { tournamentId: "t1" }))).toMatchObject({ context: "tournament", tournamentId: "t1" });
  });

  it("survives a restart", () => {
    const storage = memoryStorage();
    new StatsStore(storage).recordGame(game("red"));
    expect(new StatsStore(storage).matches).toHaveLength(1);
  });

  it("ignores a corrupted or unavailable storage", () => {
    expect(new StatsStore(memoryStorage({ "botz.stats.v1": "{not json" })).matches).toEqual([]);
    expect(new StatsStore(null).recordGame(game("red")).result).toBe("win");
  });

  it("keeps unsynced records pending until they are marked synced", () => {
    const store = new StatsStore(memoryStorage());
    const a = store.recordGame(game("red"));
    const b = store.recordGame(game("yellow"));
    const t = store.recordTournament({ id: "t1", mode: "vs_ai", winner: "red" });
    expect(store.pending().matches).toHaveLength(2);
    store.markSynced([a.id, t.id]);
    expect(store.pending().matches.map((m) => m.id)).toEqual([b.id]);
    expect(store.pending().tournaments).toEqual([]);
  });

  it("trims old synced records but never an unsynced one", () => {
    const store = new StatsStore(memoryStorage());
    const ids = Array.from({ length: 320 }, () => store.recordGame(game("red")).id);
    const keep = store.recordGame(game("yellow"));
    store.markSynced(ids);
    expect(store.matches).toHaveLength(301);
    expect(store.pending().matches.map((m) => m.id)).toEqual([keep.id]);
  });

  it("maps modes and winners to what the database stores", () => {
    expect(statsMode("solo")).toBe("vs_ai");
    expect(statsMode("passPlay")).toBe("local_2p");
    expect([outcomeFor("red"), outcomeFor("yellow"), outcomeFor(null)]).toEqual(["win", "loss", "draw"]);
  });
});

describe("summarize", () => {
  it("splits wins and losses by game and by context, and ignores 2-player games", () => {
    const store = new StatsStore(null);
    store.recordGame(game("red"));
    store.recordGame(game("red", { tournamentId: "t1" }));
    store.recordGame(game("yellow", { game: "petanque", tournamentId: "t1" }));
    store.recordGame(game("red", { mode: "local_2p" }));
    store.recordTournament({ id: "t1", mode: "vs_ai", winner: "red" });
    store.recordTournament({ id: "t2", mode: "local_2p", winner: "yellow" });

    const s = summarize(store.matches, store.tournaments, ALL_GAMES);
    expect(s.games.soccer.single).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(s.games.soccer.tournament).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(s.games.soccer.total.wins).toBe(2);
    expect(s.games.petanque.total).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(s.games.survivor.total).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(s.tournaments).toEqual({ wins: 1, losses: 0, draws: 0 });
  });
});

describe("ids", () => {
  it("builds distinct v4 uuids", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = newId();
    expect(a).toMatch(re);
    expect(newId()).not.toBe(a);
  });

  it("gives every tournament its own id", () => {
    expect(new Tournament({ games: ["soccer"] }).id).not.toBe(new Tournament({ games: ["soccer"] }).id);
  });
});
