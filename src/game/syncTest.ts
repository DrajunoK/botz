import { GameId, PLAYABLE_GAMES } from "@/config/tournament";
import type { MatchConfig } from "@/game/MatchConfig";

/**
 * Determinism check for a future online mode: two devices open the same `?synctest=<game>&seed=<n>`
 * link, both teams are played by the AI, and every turn's end state is hashed. Same hashes on both
 * screens means a match can be replayed from shot vectors alone. Pure, so it is unit-tested.
 */
export interface SyncTestOptions {
  /** Number of turns to play before the report is shown. */
  turns: number;
}

const DEFAULT_TURNS = 8;
const MAX_TURNS = 40;

/** A hash of numbers that is sensitive to the last bit of every float (FNV-1a over the IEEE-754 bytes). */
export function hashNumbers(values: readonly number[]): string {
  const view = new DataView(new ArrayBuffer(8));
  let h = 0x811c9dc5;
  for (const v of values) {
    view.setFloat64(0, v);
    for (let i = 0; i < 8; i++) {
      h ^= view.getUint8(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, "0");
}

/** `?synctest=soccer&seed=42&turns=8` → a match config, or null when the link is not a sync test. */
export function parseSyncTest(search: string): MatchConfig | null {
  const params = new URLSearchParams(search);
  const game = params.get("synctest");
  if (!game || !(PLAYABLE_GAMES as readonly string[]).includes(game)) return null;
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  const turns = Number.parseInt(params.get("turns") ?? "", 10);
  const syncTest: SyncTestOptions = {
    turns: Number.isFinite(turns) ? Math.min(Math.max(turns, 1), MAX_TURNS) : DEFAULT_TURNS,
  };
  return {
    mode: "solo",
    difficulty: "normal",
    seed: (Number.isFinite(seed) ? seed : 1) >>> 0,
    gameId: game as GameId,
    syncTest,
  };
}
