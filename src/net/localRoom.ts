import type { RoomTransport } from "@/net/realtime";
import { Envelope, normalizeRoomCode, parseEnvelope } from "@/net/protocol";

/**
 * Same-browser stand-in for the Supabase room, over a BroadcastChannel: two tabs of one browser can
 * play each other with no network. Used by `?localroom=CODE&role=host|guest` links, for development.
 */
export interface LocalRoomLink {
  code: string;
  role: "host" | "guest";
  game: string | null;
  /** Both tabs play by themselves (AI shots) so a whole match can be checked without touching the screen. */
  autoplay: boolean;
  /** The guest nudges its own world after turn 2, to exercise the host's repair. */
  drift: boolean;
}

export function parseLocalRoom(search: string): LocalRoomLink | null {
  const params = new URLSearchParams(search);
  const code = normalizeRoomCode(params.get("localroom") ?? "");
  const role = params.get("role");
  if (!code || (role !== "host" && role !== "guest")) return null;
  return { code, role, game: params.get("game"), autoplay: params.has("auto"), drift: params.has("drift") };
}

export const isLocalRoomMode = (search: string): boolean => new URLSearchParams(search).has("localroom");

type Wire = { kind: "hello"; id: string } | { kind: "bye"; id: string } | { kind: "msg"; env: unknown };

export function openLocalRoom(code: string, clientId: string): RoomTransport {
  const channel = new BroadcastChannel(`botz-room-${code}`);
  const peers = new Set<string>();
  let onMessage: (e: Envelope) => void = () => undefined;
  let onPeers: (n: number) => void = () => undefined;
  const post = (w: Wire) => channel.postMessage(w);

  channel.onmessage = (event: MessageEvent<Wire>) => {
    const w = event.data;
    if (w.kind === "hello") {
      if (peers.has(w.id)) return;
      peers.add(w.id);
      onPeers(peers.size);
      post({ kind: "hello", id: clientId }); // answer once, so the newcomer learns about us too
    } else if (w.kind === "bye") {
      peers.delete(w.id);
      onPeers(peers.size);
    } else {
      const env = parseEnvelope(w.env);
      if (env) onMessage(env);
    }
  };
  post({ kind: "hello", id: clientId });
  // A closed tab is a dropped connection: Supabase notices through presence, here we say it ourselves.
  window.addEventListener("pagehide", () => post({ kind: "bye", id: clientId }));

  return {
    joined: Promise.resolve(true),
    send: (env) => post({ kind: "msg", env }),
    onMessage: (l) => (onMessage = l),
    onPeers: (l) => (onPeers = l),
    close: () => {
      post({ kind: "bye", id: clientId });
      channel.close();
    },
  };
}
