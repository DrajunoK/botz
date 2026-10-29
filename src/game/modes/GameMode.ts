import Phaser from "phaser";
import { TeamId } from "@/config/game";
import { RoundedRect } from "@/game/field/fieldGeometry";

/**
 * Contract every mini-game mode implements. V1 ships only SoccerMode, but
 * GameScene talks to modes only through this interface so an arena / basket /
 * rally mode can be dropped in later without touching turn or aim logic.
 */
export interface GameMode {
  readonly id: string;
  readonly goalsToWin: number;

  /** Draws the field and builds its static Matter collision geometry. */
  buildField(scene: Phaser.Scene): void;

  /** Kickoff formation for a team's bots. */
  botSpawns(team: TeamId): { x: number; y: number }[];

  /** Kickoff position for the alarm clock (the ball). */
  clockSpawn(): { x: number; y: number };

  /** Outline of the playable area, used by the clock to follow walls. */
  readonly fieldRect: RoundedRect;

  /** Reference point used by the AI to reason about "my goal" / "their goal". */
  goalCenterFor(team: TeamId): { x: number; y: number };

  /** Called every physics tick during RESOLVING; returns the scoring team, if any. */
  checkScore(x: number, y: number, radius: number): TeamId | null;
}
