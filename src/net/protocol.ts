import { GameId, PLAYABLE_GAMES } from "@/config/tournament";

/**
 * Wire format of an online match. Both devices run the same simulation from the same seed, so the
 * only things that travel are the match setup and each player's locked-in shots. Phaser-free.
 */

/** A bot is named by its index in the team, never by uid: uids depend on what the page played before. */
export interface AimShot {
  index: number;
  vx: number;
  vy: number;
}

/**
 * `m` is the match id (its seed): a message about another match, such as a late shot from the game
 * before a rematch, is dropped.
 */
export type OnlineMessage =
  | { t: "start"; game: GameId; seed: number }
  | { t: "ready" }
  | { t: "aims"; m: number; turn: number; shots: AimShot[] }
  /** Host only: the world at the end of a turn, so the guest can notice (and repair) a drift. */
  | { t: "snap"; m: number; turn: number; values: number[] }
  /** "I want a rematch"; the host answers with `go` once both sides asked. */
  | { t: "rematch" }
  | { t: "go"; seed: number }
  | { t: "leave" };

export const MAX_SNAPSHOT_VALUES = 4000;

/** `from` is the sender's random client id: a third device that guesses the code cannot hijack a match. */
export interface Envelope {
  from: string;
  msg: OnlineMessage;
}

/** No 0/O/1/I: codes are read out loud and typed on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

export function makeRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** Cleans what a player typed ("ab3k ", "AB-3K"); null when it cannot be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validates whatever came off the network: anything malformed is dropped, never trusted. */
export function parseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { from, msg } = raw as { from?: unknown; msg?: unknown };
  if (typeof from !== "string" || typeof msg !== "object" || msg === null) return null;
  const m = msg as Record<string, unknown>;
  switch (m.t) {
    case "start":
      if (typeof m.game !== "string" || !(PLAYABLE_GAMES as readonly string[]).includes(m.game) || !isNum(m.seed)) return null;
      return { from, msg: { t: "start", game: m.game as GameId, seed: m.seed >>> 0 } };
    case "ready":
    case "rematch":
    case "leave":
      return { from, msg: { t: m.t } };
    case "aims": {
      if (!isNum(m.m) || !isNum(m.turn) || !Array.isArray(m.shots) || m.shots.length > 8) return null;
      const shots: AimShot[] = [];
      for (const s of m.shots) {
        if (typeof s !== "object" || s === null) return null;
        const { index, vx, vy } = s as Record<string, unknown>;
        if (!isNum(index) || !isNum(vx) || !isNum(vy)) return null;
        shots.push({ index, vx, vy });
      }
      return { from, msg: { t: "aims", m: m.m, turn: m.turn, shots } };
    }
    case "snap":
      if (!isNum(m.m) || !isNum(m.turn) || !Array.isArray(m.values) || m.values.length > MAX_SNAPSHOT_VALUES) return null;
      if (!m.values.every(isNum)) return null;
      return { from, msg: { t: "snap", m: m.m, turn: m.turn, values: m.values as number[] } };
    case "go":
      if (!isNum(m.seed)) return null;
      return { from, msg: { t: "go", seed: m.seed >>> 0 } };
    default:
      return null;
  }
}

/** Link that opens the game straight into a room: `https://botz.pomponlabs.com/?room=AB3K`. */
export const roomLink = (origin: string, code: string): string => `${origin}/?room=${code}`;

export function roomFromLink(search: string): string | null {
  return normalizeRoomCode(new URLSearchParams(search).get("room") ?? "");
}
