import type { RealtimeChannel } from "@supabase/supabase-js";
import { realtimeClient } from "@/net/cloud";
import type { Transport } from "@/net/OnlineSession";
import { isLocalRoomMode, openLocalRoom } from "@/net/localRoom";
import { Envelope, parseEnvelope } from "@/net/protocol";

/**
 * Online match transport over a Supabase Realtime channel: broadcast carries the messages, presence
 * tells who is in the room. Both are ephemeral: nothing is stored in the database.
 */
export interface RoomTransport extends Transport {
  /** Resolves true once the channel is joined, false if the network or Realtime refuses us. */
  readonly joined: Promise<boolean>;
}

const EVENT = "m";

export function openRoom(code: string, clientId: string): RoomTransport {
  if (isLocalRoomMode(window.location.search)) return openLocalRoom(code, clientId);
  const sb = realtimeClient();
  const channel: RealtimeChannel = sb.channel(`botz-room-${code}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: clientId } },
  });

  let onMessage: (e: Envelope) => void = () => undefined;
  let onPeers: (n: number) => void = () => undefined;
  let resolveJoined: (ok: boolean) => void = () => undefined;
  const joined = new Promise<boolean>((resolve) => (resolveJoined = resolve));

  channel
    .on("broadcast", { event: EVENT }, ({ payload }) => {
      const env = parseEnvelope(payload);
      if (env) onMessage(env);
    })
    .on("presence", { event: "sync" }, () => {
      onPeers(Object.keys(channel.presenceState()).filter((k) => k !== clientId).length);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ at: Date.now() }).then(() => resolveJoined(true));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        resolveJoined(false);
      }
    });

  return {
    joined,
    send: (envelope) => void channel.send({ type: "broadcast", event: EVENT, payload: envelope }),
    onMessage: (l) => (onMessage = l),
    onPeers: (l) => (onPeers = l),
    close: () => void sb.removeChannel(channel),
  };
}
