import Phaser from "phaser";
import { GOALS_TO_WIN, OPPOSITE_TEAM, TeamId } from "@/config/game";
import { GameMode } from "./GameMode";
import { SoccerField, GOAL_CENTER_Y, FIELD_LEFT, FIELD_RIGHT } from "@/game/field/SoccerField";

export class SoccerMode implements GameMode {
  readonly id = "soccer";
  readonly goalsToWin = GOALS_TO_WIN;
  private field!: SoccerField;

  buildField(scene: Phaser.Scene): void {
    this.field = new SoccerField(scene);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return SoccerField.spawnPositionsFor(team);
  }

  ballSpawn(): { x: number; y: number } {
    return SoccerField.ballSpawnPosition();
  }

  goalCenterFor(team: TeamId): { x: number; y: number } {
    // "My goal" = the goal I defend, i.e. the goal on my own side.
    const x = team === "red" ? FIELD_LEFT : FIELD_RIGHT;
    return { x, y: GOAL_CENTER_Y };
  }

  checkScore(ballX: number, ballY: number, ballRadius: number): TeamId | null {
    if (SoccerField.isFullyInGoal(this.field.leftGoal, ballX, ballY, ballRadius)) {
      return OPPOSITE_TEAM[this.field.leftGoal.defendingTeam];
    }
    if (SoccerField.isFullyInGoal(this.field.rightGoal, ballX, ballY, ballRadius)) {
      return OPPOSITE_TEAM[this.field.rightGoal.defendingTeam];
    }
    return null;
  }
}
