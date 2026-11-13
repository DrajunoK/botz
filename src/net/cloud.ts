import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/config/supabase";
import { GameId } from "@/config/tournament";
import { Stats } from "@/state/stats";

/**
 * Everything that talks to Supabase. Each call resolves to `null` / `false` instead of throwing
 * when the network, the session or the database fails: the game must stay playable offline.
 */

export interface Profile {
  nickname: string;
  friendCode: string;
}

export interface FriendStats {
  id: string;
  nickname: string;
  wins: number;
  losses: number;
  byGame: Partial<Record<GameId, { wins: number; losses: number }>>;
}

export interface BoardRow {
  nickname: string;
  wins: number;
  losses: number;
}

/** Network / database failures are expected offline, but a developer needs to see why. */
const warn = (where: string, err: unknown): void => console.warn(`[cloud] ${where}:`, err);

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Id of the signed-in user; the first call on a fresh install creates an anonymous account. */
async function ensureUser(): Promise<string | null> {
  try {
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: created, error } = await sb.auth.signInAnonymously();
    if (error) warn("anonymous sign-in", error);
    return error ? null : (created.user?.id ?? null);
  } catch (err) {
    warn("anonymous sign-in", err);
    return null;
  }
}

let syncing: Promise<boolean> | null = null;

/** Uploads every finished game / tournament the cloud has not seen yet. Safe to call often. */
export function syncStats(): Promise<boolean> {
  syncing ??= upload().finally(() => (syncing = null));
  return syncing;
}

async function upload(): Promise<boolean> {
  const { matches, tournaments } = Stats.pending();
  if (matches.length === 0 && tournaments.length === 0) return true;
  if (!(await ensureUser())) return false;
  try {
    const sb = supabase();
    // Tournaments first, so a match never points at a tournament the cloud does not know yet.
    if (tournaments.length > 0) {
      const rows = tournaments.map((t) => ({ id: t.id, mode: t.mode, result: t.result, played_at: t.playedAt }));
      const { error } = await sb.from("tournaments").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) return warn("upload tournaments", error), false;
      Stats.markSynced(tournaments.map((t) => t.id));
    }
    if (matches.length > 0) {
      const rows = matches.map((m) => ({
        id: m.id,
        game: m.game,
        mode: m.mode,
        context: m.context,
        tournament_id: m.tournamentId ?? null,
        result: m.result,
        score_for: m.scoreFor,
        score_against: m.scoreAgainst,
        played_at: m.playedAt,
      }));
      const { error } = await sb.from("matches").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) return warn("upload matches", error), false;
      Stats.markSynced(matches.map((m) => m.id));
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchProfile(): Promise<Profile | null> {
  const id = await ensureUser();
  if (!id) return null;
  try {
    const { data, error } = await supabase().from("profiles").select("nickname, friend_code").eq("id", id).single();
    if (error) warn("profile", error);
    return error || !data ? null : { nickname: data.nickname, friendCode: data.friend_code };
  } catch (err) {
    warn("profile", err);
    return null;
  }
}

/** Returns an error message for the player, or null when the nickname was saved. */
export async function setNickname(nickname: string): Promise<string | null> {
  const id = await ensureUser();
  if (!id) return "Pas de connexion";
  const trimmed = nickname.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return "Le pseudo doit faire 2 à 20 caractères";
  try {
    const { error } = await supabase().from("profiles").update({ nickname: trimmed }).eq("id", id);
    if (error?.code === "23505") return "Ce pseudo est déjà pris";
    if (error?.message.includes("nickname not allowed")) return "Ce pseudo n'est pas autorisé";
    return error ? "Impossible d'enregistrer le pseudo" : null;
  } catch {
    return "Pas de connexion";
  }
}

/** Adds a friend by code. Resolves to `{ nickname }` on success or `{ error }` to show the player. */
export async function addFriend(code: string): Promise<{ nickname: string } | { error: string }> {
  if (!(await ensureUser())) return { error: "Pas de connexion" };
  try {
    const { data, error } = await supabase().rpc("add_friend", { code });
    if (!error) return { nickname: String(data) };
    if (error.message.includes("unknown friend code")) return { error: "Code inconnu" };
    if (error.message.includes("cannot add yourself")) return { error: "C'est ton propre code !" };
    return { error: "Impossible d'ajouter cet ami" };
  } catch {
    return { error: "Pas de connexion" };
  }
}

export async function fetchFriends(): Promise<FriendStats[] | null> {
  if (!(await ensureUser())) return null;
  try {
    const { data, error } = await supabase().rpc("friends_stats");
    if (error) warn("friends_stats", error);
    if (error || !data) return null;
    const byId = new Map<string, FriendStats>();
    for (const row of data as { friend_id: string; nickname: string; game: GameId | null; wins: number; losses: number }[]) {
      let friend = byId.get(row.friend_id);
      if (!friend) byId.set(row.friend_id, (friend = { id: row.friend_id, nickname: row.nickname, wins: 0, losses: 0, byGame: {} }));
      if (!row.game) continue;
      friend.wins += row.wins;
      friend.losses += row.losses;
      friend.byGame[row.game] = { wins: row.wins, losses: row.losses };
    }
    return [...byId.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  } catch {
    return null;
  }
}

/** Global ranking of one game, or of tournaments when `game` is "tournament". */
export async function fetchLeaderboard(game: GameId | "tournament" | null, limit = 10): Promise<BoardRow[] | null> {
  if (!(await ensureUser())) return null;
  try {
    const { data, error } =
      game === "tournament"
        ? await supabase().rpc("tournament_leaderboard", { p_limit: limit })
        : await supabase().rpc("leaderboard", { p_game: game, p_limit: limit });
    if (error) warn("leaderboard", error);
    return error || !data ? null : (data as BoardRow[]);
  } catch (err) {
    warn("leaderboard", err);
    return null;
  }
}
