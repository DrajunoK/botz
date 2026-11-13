import Phaser from "phaser";
import { GOALS_TO_WIN, OPPOSITE_TEAM, TeamId } from "@/config/game";
import { ClockRules, GameMode } from "./GameMode";
import { SoccerField, GOAL_CENTER_Y, FIELD_LEFT, FIELD_RIGHT, FIELD_RECT } from "@/game/field/SoccerField";

export class SoccerMode implements GameMode {
  readonly id = "soccer";
  readonly goalsToWin = GOALS_TO_WIN;
  readonly hud = { alarmGauge: true, standings: false };
  private field!: SoccerField;

  readonly clock: ClockRules = {
    spawn: () => SoccerField.clockSpawnPosition(),
    fieldRect: FIELD_RECT,
    // "My goal" = the goal I defend, i.e. the goal on my own side.
    goalCenterFor: (team: TeamId) => ({ x: team === "red" ? FIELD_LEFT : FIELD_RIGHT, y: GOAL_CENTER_Y }),
    checkScore: (x, y, radius) => {
      if (SoccerField.isFullyInGoal(this.field.leftGoal, x, y, radius)) {
        return OPPOSITE_TEAM[this.field.leftGoal.defendingTeam];
      }
      if (SoccerField.isFullyInGoal(this.field.rightGoal, x, y, radius)) {
        return OPPOSITE_TEAM[this.field.rightGoal.defendingTeam];
      }
      return null;
    },
  };

  buildField(scene: Phaser.Scene): void {
    this.field = new SoccerField(scene);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return SoccerField.spawnPositionsFor(team);
  }
}
