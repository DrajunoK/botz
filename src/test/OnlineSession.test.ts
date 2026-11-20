import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIMS_RESEND_MS, DISCONNECT_GRACE_MS, OnlineSession, Transport } from "@/net/OnlineSession";
import type { Envelope } from "@/net/protocol";

/** Two in-memory devices in one room. `drop` swallows the next messages sent by a device. */
class FakeRoom {
  private readonly members: FakeTransport[] = [];
  join(): FakeTransport {
    const t = new FakeTransport(this);
    this.members.push(t);
    this.announce();
    return t;
  }
  leave(t: FakeTransport): void {
    this.members.splice(this.members.indexOf(t), 1);
    this.announce();
  }
  deliver(from: FakeTransport, env: Envelope): void {
    for (const m of this.members) if (m !== from) m.messageListener?.(env);
  }
  private announce(): void {
    for (const m of this.members) m.peersListener?.(this.members.length - 1);
  }
}

class FakeTransport implements Transport {
  messageListener?: (e: Envelope) => void;
  peersListener?: (n: number) => void;
  dropped = 0;
  constructor(private readonly room: FakeRoom) {}
  send(env: Envelope): void {
    if (this.dropped > 0) this.dropped -= 1;
    else this.room.deliver(this, env);
  }
  onMessage(l: (e: Envelope) => void): void {
    this.messageListener = l;
  }
  onPeers(l: (n: number) => void): void {
    this.peersListener = l;
    l(0);
  }
  close(): void {
    this.room.leave(this);
  }
}

function pair() {
  const room = new FakeRoom();
  const hostT = room.join();
  const host = new OnlineSession(hostT, "host", "host-id");
  const guestT = room.join();
  const guest = new OnlineSession(guestT, "guest", "guest-id");
  return { room, host, guest, hostT, guestT };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("lobby handshake", () => {
  it("starts both sides with the host's game and seed, host red and guest yellow", () => {
    const room = new FakeRoom();
    const host = new OnlineSession(room.join(), "host", "h");
    const started = { host: vi.fn(), guest: vi.fn() };
    host.onStart = started.host;
    host.offerMatch("petanque", 99);
    const guest = new OnlineSession(room.join(), "guest", "g");
    guest.onStart = started.guest;
    vi.advanceTimersByTime(1000); // the first offer went out before the guest was listening
    expect(started.guest).toHaveBeenCalledWith({ game: "petanque", seed: 99 });
    expect(started.host).toHaveBeenCalledWith({ game: "petanque", seed: 99 });
    expect([host.team, guest.team]).toEqual(["red", "yellow"]);
  });

  it("keeps offering until the guest answers", () => {
    const room = new FakeRoom();
    const hostT = room.join();
    const host = new OnlineSession(hostT, "host", "h");
    host.offerMatch("soccer", 1);
    hostT.dropped = 2; // the first two offers are lost
    const guestT = room.join();
    const guest = new OnlineSession(guestT, "guest", "g");
    const onStart = vi.fn();
    guest.onStart = onStart;
    expect(onStart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("ignores a third device once an opponent is chosen", () => {
    const { room, host } = pair();
    host.offerMatch("soccer", 5);
    const intruderT = room.join();
    const intruder = new OnlineSession(intruderT, "guest", "intruder");
    const onStart = vi.fn();
    intruder.onStart = onStart;
    vi.advanceTimersByTime(3000);
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe("shots", () => {
  function playing() {
    const p = pair();
    p.host.offerMatch("soccer", 1);
    return p;
  }

  it("delivers locked-in shots to the other side by turn", () => {
    const { host, guest } = playing();
    host.sendAims(1, [{ index: 0, vx: 3, vy: -2 }]);
    expect(guest.peerAims(1)).toEqual([{ index: 0, vx: 3, vy: -2 }]);
    expect(guest.peerAims(2)).toBeUndefined();
  });

  it("re-sends shots until the opponent's own shots come back", () => {
    const { host, guest, hostT } = playing();
    hostT.dropped = 1;
    host.sendAims(1, [{ index: 1, vx: 1, vy: 1 }]);
    expect(guest.peerAims(1)).toBeUndefined();
    vi.advanceTimersByTime(AIMS_RESEND_MS);
    expect(guest.peerAims(1)).toBeDefined();
  });

  it("lets the host share its world at the end of a turn, and only the host", () => {
    const { host, guest } = playing();
    host.sendSnapshot(3, [1, 2, 3.5]);
    guest.sendSnapshot(3, [9, 9, 9]);
    expect(guest.hostSnapshot(3)).toEqual([1, 2, 3.5]);
    expect(host.hostSnapshot(3)).toBeUndefined();
  });
});

describe("leaving", () => {
  it("tells the opponent immediately when someone quits", () => {
    const { host, guest } = (() => {
      const p = pair();
      p.host.offerMatch("soccer", 1);
      return p;
    })();
    const left = vi.fn();
    host.onPeerLeft = left;
    guest.leave();
    expect(left).toHaveBeenCalledWith("quit");
  });

  it("waits out a short disconnection", () => {
    const p = pair();
    p.host.offerMatch("soccer", 1);
    const left = vi.fn();
    const back = vi.fn();
    p.host.onPeerLeft = left;
    p.host.onPeerBack = back;
    p.room.leave(p.guestT); // the guest's connection drops
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1000);
    expect(left).not.toHaveBeenCalled();
    const guestT2 = p.room.join(); // and comes back
    void guestT2;
    expect(back).toHaveBeenCalled();
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS * 2);
    expect(left).not.toHaveBeenCalled();
  });

  it("gives up after the grace period", () => {
    const p = pair();
    p.host.offerMatch("soccer", 1);
    const left = vi.fn();
    p.host.onPeerLeft = left;
    p.room.leave(p.guestT);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 10);
    expect(left).toHaveBeenCalledWith("disconnected");
  });
});

describe("rematch", () => {
  function finished(seeds: number[] = [111, 222]) {
    const room = new FakeRoom();
    const hostT = room.join();
    const host = new OnlineSession(hostT, "host", "h", () => seeds.shift() ?? 0);
    const guest = new OnlineSession(room.join(), "guest", "g");
    host.offerMatch("soccer", 7);
    vi.advanceTimersByTime(1000);
    const starts = { host: vi.fn(), guest: vi.fn() };
    host.onRematch = starts.host;
    guest.onRematch = starts.guest;
    host.endMatch();
    guest.endMatch();
    return { host, guest, starts, hostT };
  }

  it("starts only when both players ask, with a seed picked by the host", () => {
    const { host, guest, starts } = finished();
    guest.askRematch();
    expect(starts.host).not.toHaveBeenCalled();
    host.askRematch();
    expect(starts.host).toHaveBeenCalledWith({ seed: 111 });
    expect(starts.guest).toHaveBeenCalledWith({ seed: 111 });
  });

  it("works whichever side asks first, and again after the next game", () => {
    const { host, guest, starts } = finished();
    host.askRematch();
    guest.askRematch();
    expect(starts.guest).toHaveBeenCalledTimes(1);
    host.endMatch();
    guest.endMatch();
    guest.askRematch();
    host.askRematch();
    expect(starts.guest).toHaveBeenLastCalledWith({ seed: 222 });
  });

  it("ignores shots from the previous match", () => {
    const { host, guest } = finished();
    host.sendAims(1, [{ index: 0, vx: 1, vy: 1 }]); // match 7
    guest.askRematch();
    host.askRematch();
    expect(guest.peerAims(1)).toBeUndefined(); // new match: history cleared
    host.sendAims(1, [{ index: 2, vx: 5, vy: 5 }]);
    expect(guest.peerAims(1)).toEqual([{ index: 2, vx: 5, vy: 5 }]);
  });

  it("answers again when the go message was lost", () => {
    const { host, guest, starts, hostT } = finished();
    guest.askRematch();
    hostT.dropped = 2; // neither the host's own request nor its `go` arrives
    host.askRematch();
    expect(starts.guest).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500); // the guest asks again
    expect(starts.guest).toHaveBeenCalledWith({ seed: 111 });
  });

  it("is not available while the match is still being played", () => {
    const room = new FakeRoom();
    const host = new OnlineSession(room.join(), "host", "h");
    const guest = new OnlineSession(room.join(), "guest", "g");
    host.offerMatch("soccer", 7);
    vi.advanceTimersByTime(1000);
    const started = vi.fn();
    host.onRematch = started;
    guest.askRematch();
    host.askRematch();
    expect(started).not.toHaveBeenCalled();
  });
});
