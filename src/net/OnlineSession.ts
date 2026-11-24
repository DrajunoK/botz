import { TeamId } from "@/config/game";
import { GameId } from "@/config/tournament";
import type { AimShot, Envelope, OnlineMessage } from "@/net/protocol";

/** What the session needs from the network; the Supabase one lives in realtime.ts, tests use a fake. */
export interface Transport {
  send(envelope: Envelope): void;
  onMessage(listener: (envelope: Envelope) => void): void;
  /** Number of OTHER devices currently in the room. */
  onPeers(listener: (others: number) => void): void;
  close(): void;
}

export type PeerLeftReason = "quit" | "disconnected";
export type SessionRole = "host" | "guest";

export const START_RESEND_MS = 1000;
export const AIMS_RESEND_MS = 2000;
export const REMATCH_RESEND_MS = 1500;
/** A phone that locks its screen or loses signal for less than this is waited for. */
export const DISCONNECT_GRACE_MS = 20_000;

const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32) >>> 0;

/**
 * One device's side of an online match: the lobby handshake, the exchange of locked-in shots, and
 * rematches. The host plays red and the guest yellow. Phaser-free so the whole protocol is unit-tested.
 */
export class OnlineSession {
  readonly team: TeamId;

  /** Guest: the host's setup arrived. Host: the guest confirmed it. */
  onStart?: (info: { game: GameId; seed: number; games?: GameId[] }) => void;
  /** Both players asked for a rematch: play again with this seed. */
  onRematch?: (info: { seed: number }) => void;
  onPeerLeft?: (reason: PeerLeftReason) => void;
  /** The opponent's connection dropped: they have DISCONNECT_GRACE_MS to come back. */
  onPeerAway?: () => void;
  onPeerBack?: () => void;
  /** The opponent sent one of the quick messages. */
  onSay?: (id: number) => void;

  private peerId: string | null = null;
  private others = 0;
  private closed = false;
  private playing = false;
  /** Seed of the match being played: messages about any other match are dropped. */
  private matchId = 0;
  private matchOver = false;
  private startMessage: OnlineMessage | null = null;
  private startTimer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private aimsTimer: ReturnType<typeof setInterval> | null = null;
  private rematchTimer: ReturnType<typeof setInterval> | null = null;
  private wantsRematch = false;
  private peerWantsRematch = false;

  private readonly peerAimsByTurn = new Map<number, AimShot[]>();
  private readonly snapshotsByTurn = new Map<number, number[]>();
  private lastAims: { turn: number; shots: AimShot[] } | null = null;

  constructor(
    private readonly transport: Transport,
    readonly role: SessionRole,
    private readonly clientId: string,
    private readonly newSeed: () => number = randomSeed,
  ) {
    this.team = role === "host" ? "red" : "yellow";
    transport.onMessage((env) => this.receive(env));
    transport.onPeers((n) => this.peersChanged(n));
  }

  get opponentTeam(): TeamId {
    return this.team === "red" ? "yellow" : "red";
  }

  get isClosed(): boolean {
    return this.closed;
  }

  // ───────────────────────────── lobby ─────────────────────────────

  /** Host: offer this match to whoever joins the room (repeated until the guest confirms). */
  offerMatch(game: GameId, seed: number, games?: GameId[]): void {
    this.startMessage = { t: "start", game, seed, ...(games ? { games } : {}) };
    this.sendStartIfGuestPresent();
  }

  private sendStartIfGuestPresent(): void {
    if (!this.startMessage || this.playing || this.others < 1 || this.startTimer) return;
    // Armed before the first send: the answer can come back synchronously and must be able to stop it.
    this.startTimer = setInterval(() => this.startMessage && this.send(this.startMessage), START_RESEND_MS);
    this.send(this.startMessage);
  }

  private stopStartTimer(): void {
    if (this.startTimer) clearInterval(this.startTimer);
    this.startTimer = null;
  }

  private beginMatch(seed: number): void {
    this.matchId = seed;
    this.matchOver = false;
    this.wantsRematch = false;
    this.peerWantsRematch = false;
    this.peerAimsByTurn.clear();
    this.snapshotsByTurn.clear();
    this.lastAims = null;
    this.stopAimsTimer();
    this.stopRematchTimer();
  }

  // ───────────────────────────── during the match ─────────────────────────────

  /** Locks in this device's shots for `turn`; they are re-sent until the opponent's own shots show they arrived. */
  sendAims(turn: number, shots: AimShot[]): void {
    this.lastAims = { turn, shots };
    this.send({ t: "aims", m: this.matchId, turn, shots });
    if (this.aimsTimer) clearInterval(this.aimsTimer);
    this.aimsTimer = setInterval(() => {
      if (!this.lastAims || this.peerAimsByTurn.has(this.lastAims.turn)) this.stopAimsTimer();
      else this.send({ t: "aims", m: this.matchId, ...this.lastAims });
    }, AIMS_RESEND_MS);
  }

  private stopAimsTimer(): void {
    if (this.aimsTimer) clearInterval(this.aimsTimer);
    this.aimsTimer = null;
  }

  peerAims(turn: number): AimShot[] | undefined {
    return this.peerAimsByTurn.get(turn);
  }

  /** Host: the world at the end of `turn` (the guest compares it with its own and repairs a drift). */
  sendSnapshot(turn: number, values: number[]): void {
    if (this.role === "host") this.send({ t: "snap", m: this.matchId, turn, values });
  }

  /** Guest: what the host's world looked like at the end of `turn`, once it has arrived. */
  hostSnapshot(turn: number): number[] | undefined {
    return this.snapshotsByTurn.get(turn);
  }

  /** Sends a quick message (index into QUICK_MESSAGES); no retry, a lost joke is not worth one. */
  say(id: number): void {
    this.send({ t: "say", id });
  }

  /** The match just ended: from now on a rematch request counts. */
  endMatch(): void {
    this.matchOver = true;
    this.stopAimsTimer();
  }

  // ───────────────────────────── rematch ─────────────────────────────

  /** This player wants to play again. Starts when the other one does too (the host picks the new seed). */
  askRematch(): void {
    if (this.closed || !this.matchOver) return;
    this.wantsRematch = true;
    this.send({ t: "rematch" });
    this.stopRematchTimer();
    this.rematchTimer = setInterval(() => this.send({ t: "rematch" }), REMATCH_RESEND_MS);
    this.maybeStartRematch();
  }

  private maybeStartRematch(): void {
    if (this.role !== "host" || !this.wantsRematch || !this.peerWantsRematch) return;
    const seed = this.newSeed();
    this.send({ t: "go", seed });
    this.startRematch(seed);
  }

  private startRematch(seed: number): void {
    this.beginMatch(seed);
    this.lastGoSeed = seed;
    this.onRematch?.({ seed });
  }

  private lastGoSeed: number | null = null;

  private stopRematchTimer(): void {
    if (this.rematchTimer) clearInterval(this.rematchTimer);
    this.rematchTimer = null;
  }

  // ───────────────────────────── leaving ─────────────────────────────

  /** Quitting on purpose: tells the opponent right away instead of making them wait out the grace period. */
  leave(): void {
    if (this.closed) return;
    this.send({ t: "leave" });
    this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopStartTimer();
    this.stopAimsTimer();
    this.stopRematchTimer();
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.transport.close();
  }

  // ───────────────────────────── receiving ─────────────────────────────

  private send(msg: OnlineMessage): void {
    if (!this.closed) this.transport.send({ from: this.clientId, msg });
  }

  private receive({ from, msg }: Envelope): void {
    if (this.closed || from === this.clientId) return;
    // Only the first device we talk to is our opponent: anyone else who guesses the code is ignored.
    if (this.peerId !== null && from !== this.peerId) return;

    switch (msg.t) {
      case "start":
        if (this.role !== "guest") return;
        this.peerId = from;
        this.send({ t: "ready" }); // answered every time: the host keeps offering until it hears us
        if (!this.playing) {
          this.playing = true;
          this.beginMatch(msg.seed);
          this.onStart?.({ game: msg.game, seed: msg.seed, games: msg.games });
        }
        return;
      case "ready":
        if (this.role !== "host" || !this.startMessage || this.playing || this.startMessage.t !== "start") return;
        this.peerId = from;
        this.playing = true;
        this.stopStartTimer();
        this.beginMatch(this.startMessage.seed);
        this.onStart?.({ game: this.startMessage.game, seed: this.startMessage.seed, games: this.startMessage.games });
        return;
      case "aims":
        if (this.playing && msg.m === this.matchId) this.peerAimsByTurn.set(msg.turn, msg.shots);
        return;
      case "snap":
        if (this.playing && msg.m === this.matchId) this.snapshotsByTurn.set(msg.turn, msg.values);
        return;
      case "rematch":
        if (!this.playing) return;
        if (!this.matchOver) {
          // Their request was already granted but our answer got lost: say it again.
          if (this.role === "host" && this.lastGoSeed === this.matchId) this.send({ t: "go", seed: this.lastGoSeed });
          return;
        }
        this.peerWantsRematch = true;
        this.maybeStartRematch();
        return;
      case "go":
        if (this.role === "guest" && this.playing && this.matchOver && this.wantsRematch && msg.seed !== this.matchId) this.startRematch(msg.seed);
        return;
      case "say":
        if (this.playing) this.onSay?.(msg.id);
        return;
      case "leave":
        if (this.playing) this.peerLeft("quit");
        return;
    }
  }

  private peerLeft(reason: PeerLeftReason): void {
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = null;
    this.close();
    this.onPeerLeft?.(reason);
  }

  private peersChanged(others: number): void {
    const before = this.others;
    this.others = others;
    if (this.closed) return;

    if (!this.playing) {
      if (others >= 1) this.sendStartIfGuestPresent();
      else this.stopStartTimer();
      return;
    }

    if (others === 0 && before > 0) {
      this.graceTimer ??= setTimeout(() => this.peerLeft("disconnected"), DISCONNECT_GRACE_MS);
      this.onPeerAway?.();
    } else if (others > 0 && this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
      this.onPeerBack?.();
      this.resendLast();
    }
  }

  /** After a reconnection: say again what the opponent may have missed. */
  private resendLast(): void {
    if (this.lastAims) this.send({ t: "aims", m: this.matchId, ...this.lastAims });
    if (this.wantsRematch) this.send({ t: "rematch" });
  }
}
