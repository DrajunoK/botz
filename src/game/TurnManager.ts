import { TeamId } from "@/config/game";
import {
  AIM_DURATION_MS,
  RESOLVE_MAX_DURATION_MS,
  SETTLE_SPEED_THRESHOLD,
  SETTLE_STABLE_TICKS,
  GOALS_TO_WIN,
} from "@/config/game";
import { EventEmitter } from "@/game/util/EventEmitter";

export type TurnPhase = "AIMING" | "RESOLVING" | "GOAL_PAUSE" | "GAME_OVER";

export interface ShotVector {
  botUid: number;
  vx: number;
  vy: number;
}

export interface TurnManagerOptions {
  aimDurationMs?: number;
  resolveMaxDurationMs?: number;
  /** The resolution never ends before this much time has passed (the alarm clock's run time). */
  minResolveMs?: number;
  settleSpeedThreshold?: number;
  settleStableTicks?: number;
  goalsToWin?: number;
}

/**
 * Drives the simultaneous-turn state machine: AIMING -> RESOLVING -> (GOAL_PAUSE) -> AIMING ...
 * Framework-agnostic aside from using Phaser's lightweight EventEmitter, so it can run
 * headless in unit tests by feeding it fake per-tick speed samples.
 *
 * Events emitted:
 *  - "resolve" (shots: ShotVector[])   -> caller should apply impulses to bodies
 *  - "settled"                         -> resolution finished naturally (or timed out); a listener may call endGame()
 *  - "goal" (team: TeamId)             -> a goal was scored by `team`
 *  - "gameOver" (winner: TeamId)       -> match is over
 *  - "aimPhaseStarted"
 */
export class TurnManager extends EventEmitter {
  phase: TurnPhase = "AIMING";
  aimTimeRemainingMs: number;
  score: Record<TeamId, number> = { red: 0, yellow: 0 };
  /** 1-based number of the current turn in the match. */
  turnNumber = 1;

  private readonly aimDurationMs: number;
  private readonly resolveMaxDurationMs: number;
  private readonly minResolveMs: number;
  private readonly settleSpeedThreshold: number;
  private readonly settleStableTicks: number;
  private readonly goalsToWin: number;

  private pendingAims = new Map<number, ShotVector>();
  private teamReady: Record<TeamId, boolean> = { red: false, yellow: false };
  private resolveElapsedMs = 0;
  private stableTickCount = 0;
  private goalScoredThisResolution = false;

  constructor(options: TurnManagerOptions = {}) {
    super();
    this.aimDurationMs = options.aimDurationMs ?? AIM_DURATION_MS;
    this.resolveMaxDurationMs = options.resolveMaxDurationMs ?? RESOLVE_MAX_DURATION_MS;
    this.minResolveMs = options.minResolveMs ?? 0;
    this.settleSpeedThreshold = options.settleSpeedThreshold ?? SETTLE_SPEED_THRESHOLD;
    this.settleStableTicks = options.settleStableTicks ?? SETTLE_STABLE_TICKS;
    this.goalsToWin = options.goalsToWin ?? GOALS_TO_WIN;
    this.aimTimeRemainingMs = this.aimDurationMs;
  }

  startAimPhase(): void {
    this.phase = "AIMING";
    this.aimTimeRemainingMs = this.aimDurationMs;
    this.pendingAims.clear();
    this.teamReady = { red: false, yellow: false };
    this.turnNumber += 1;
    this.emit("aimPhaseStarted");
  }

  /** Restarts the aim countdown without clearing pending aims — used to give each
   * local player their own timer in sequential pass & play, within one logical turn. */
  resetAimTimer(): void {
    if (this.phase !== "AIMING") return;
    this.aimTimeRemainingMs = this.aimDurationMs;
  }

  setAim(botUid: number, vx: number, vy: number): void {
    if (this.phase !== "AIMING") return;
    this.pendingAims.set(botUid, { botUid, vx, vy });
  }

  clearAim(botUid: number): void {
    if (this.phase !== "AIMING") return;
    this.pendingAims.delete(botUid);
  }

  hasAim(botUid: number): boolean {
    return this.pendingAims.has(botUid);
  }

  setTeamReady(team: TeamId): void {
    if (this.phase !== "AIMING") return;
    this.teamReady[team] = true;
    if (this.teamReady.red && this.teamReady.yellow) {
      this.beginResolution();
    }
  }

  /** Advance the state machine. `speeds` is every dynamic body's current speed, sampled this tick. */
  update(deltaMs: number, speeds: number[]): void {
    if (this.phase === "AIMING") {
      this.aimTimeRemainingMs -= deltaMs;
      if (this.aimTimeRemainingMs <= 0) {
        this.aimTimeRemainingMs = 0;
        this.beginResolution();
      }
      return;
    }

    if (this.phase === "RESOLVING") {
      this.resolveElapsedMs += deltaMs;
      const allSlow = speeds.every((s) => s <= this.settleSpeedThreshold);
      this.stableTickCount = allSlow ? this.stableTickCount + 1 : 0;

      const settled = this.stableTickCount >= this.settleStableTicks && this.resolveElapsedMs >= this.minResolveMs;
      const timedOut = this.resolveElapsedMs >= this.resolveMaxDurationMs;
      if (settled || timedOut) {
        this.emit("settled");
        // A "settled" listener may have ended the game (e.g. last bot of a team eliminated).
        if (this.phase === "RESOLVING") this.startAimPhase();
      }
      return;
    }
    // GOAL_PAUSE and GAME_OVER are advanced explicitly by the caller (resumeAfterGoal / no-op).
  }

  /** Called by the scene when the ball is detected fully inside a goal zone, during RESOLVING. */
  reportGoal(scoringTeam: TeamId): void {
    if (this.phase !== "RESOLVING" || this.goalScoredThisResolution) return;
    this.goalScoredThisResolution = true;
    this.score[scoringTeam] += 1;
    this.emit("goal", scoringTeam);

    if (this.score[scoringTeam] >= this.goalsToWin) {
      this.endGame(scoringTeam);
    } else {
      this.phase = "GOAL_PAUSE";
    }
  }

  /**
   * Ends the match for modes that are not decided by reaching a score (e.g. last team standing).
   * `finalScore` replaces the running score so the ranking shows a meaningful result.
   */
  endGame(winner: TeamId, finalScore?: Record<TeamId, number>): void {
    if (this.phase === "GAME_OVER") return;
    if (finalScore) this.score = { ...finalScore };
    this.phase = "GAME_OVER";
    this.emit("gameOver", winner);
  }

  /**
   * Holds the game between two turns (an end-of-round animation) instead of starting the next aim
   * phase; `resumeAfterGoal()` then continues. Meant to be called from a "settled" listener.
   */
  pause(): void {
    if (this.phase === "RESOLVING") this.phase = "GOAL_PAUSE";
  }

  /** Called once the goal celebration + reset-to-kickoff has finished. */
  resumeAfterGoal(): void {
    if (this.phase !== "GOAL_PAUSE") return;
    this.startAimPhase();
  }

  private beginResolution(): void {
    this.phase = "RESOLVING";
    this.resolveElapsedMs = 0;
    this.stableTickCount = 0;
    this.goalScoredThisResolution = false;
    const shots = Array.from(this.pendingAims.values());
    this.emit("resolve", shots);
  }
}
