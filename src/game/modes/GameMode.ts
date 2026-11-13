import Phaser from "phaser";
import { TeamId } from "@/config/game";
import { RoundedRect } from "@/game/field/fieldGeometry";
import type { Bot } from "@/game/entities/Bot";
import type { DebrisField } from "@/game/entities/Debris";
import type { AIBotState, AIShot } from "@/game/AIController";
import type { Difficulty } from "@/config/game";
import type { Rng } from "@/game/Rng";

/** What a mode may look at and change while a game is running. */
export interface ModeContext {
  scene: Phaser.Scene;
  /** Every bot of the game, eliminated ones included. */
  bots: readonly Bot[];
  debris: DebrisField;
  /** Seeded generator reserved for the mode (jack placement...). */
  rng: Rng;
}

/** Which HUD blocks the game uses: the alarm-clock gauge, or botz-still-standing counters instead of a score. */
export interface HudLayout {
  alarmGauge: boolean;
  /** Show botz-still-in-play icons in the score pill instead of numbers. */
  standings: boolean;
}

export interface ModeAIContext {
  team: TeamId;
  /** Botz still in play. */
  bots: AIBotState[];
  opponentBots: AIBotState[];
  /** The AI's own botz in play, including the ones that cannot be aimed this turn. */
  ownBots: AIBotState[];
  difficulty: Difficulty;
  rng: () => number;
}

/** Everything specific to games played around the runaway alarm clock (the ball). */
export interface ClockRules {
  /** Kickoff position for the alarm clock. */
  spawn(): { x: number; y: number };

  /** Outline of the playable area, used by the clock to follow walls. */
  readonly fieldRect: RoundedRect;

  /** Reference point used by the AI to reason about "my goal" / "their goal". */
  goalCenterFor(team: TeamId): { x: number; y: number };

  /** Called every physics tick during RESOLVING; returns the scoring team, if any. */
  checkScore(x: number, y: number, radius: number): TeamId | null;
}

/**
 * Contract every mini-game implements. GameScene talks to modes only through this interface,
 * so turn, aim and tournament logic stay shared between Foot, Survivant and Pétanque.
 */
export interface GameMode {
  readonly id: string;
  /** Score a team must reach to win (goals, points...). */
  readonly goalsToWin: number;

  /** Draws the field and builds its static Matter collision geometry. */
  buildField(scene: Phaser.Scene): void;

  /** Starting formation for a team's bots. */
  botSpawns(team: TeamId): { x: number; y: number }[];

  /** Present only when the game is played with the alarm clock; absent modes have no clock at all. */
  readonly clock?: ClockRules;

  readonly hud: HudLayout;

  /** Called at the start of every aim phase (`turnNumber` is 1-based). */
  onAimPhase?(ctx: ModeContext, turnNumber: number): void;

  /** Called after every fixed physics step of a resolution. */
  afterStep?(ctx: ModeContext): void;

  /** Short HUD pill for the aim phase `turnNumber`: a warning, or plain info like "Mène 2 · Lancer 1/3". */
  notice?(turnNumber: number): { text: string; warning?: boolean } | null;

  /** Multiplies every shot's speed (Pétanque throws further than a Foot shot). Defaults to 1. */
  readonly shotSpeedScale?: number;

  /** Whether `bot` may be aimed this turn. Defaults to "any bot still in play". */
  canAim?(bot: Bot): boolean;

  /** The score to display and report, for modes that keep their own (Pétanque). */
  score?(): Record<TeamId, number>;

  /** Called every time a resolution settles, before the next aim phase. Return `pauseMs` to hold the game that long. */
  onSettled?(ctx: ModeContext): { pauseMs: number } | null;

  /** Called when a pause requested by `onSettled` is over, right before the next aim phase. */
  onResume?(ctx: ModeContext): void;

  /** Speeds of bodies the mode owns (the jack), so the resolution waits for them to stop. */
  extraSpeeds?(): number[];

  /** Per-frame drawing of objects the mode owns. */
  syncVisuals?(simTimeMs: number, dtSec: number): void;

  /** AI shots for modes without a clock; clock modes use the soccer AI. */
  aiShots?(ctx: ModeAIContext): AIShot[];

  /**
   * Called each time a resolution settles. Returns the winner (with the final score shown on the
   * ranking) when the game is decided by something other than a running score, else null.
   */
  checkWinner?(ctx: ModeContext): { winner: TeamId; score: Record<TeamId, number> } | null;
}
