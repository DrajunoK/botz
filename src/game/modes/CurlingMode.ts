import Phaser from "phaser";
import { BOTZ_PER_TEAM, TeamId } from "@/config/game";
import { CIRCLE_CENTER, HOUSE_CENTER, HOUSE_RADIUS, MEASURE_MS, POINTS_TO_WIN, SHOT_SPEED_SCALE } from "@/config/curling";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { CurlingField } from "@/game/field/CurlingField";
import type { Bot } from "@/game/entities/Bot";
import { PetanqueAI } from "@/game/PetanqueAI";
import { scoreCurlingEnd } from "@/game/curling";

/**
 * Curling: each end, both teams slide their 3 botz one at a time (simultaneously) towards the house.
 * The closest bot scores, plus one point for every teammate closer than the opponent's best, so an end
 * can be worth several points. Only botz inside the house count. First to 5 points wins.
 */
export class CurlingMode implements GameMode {
  readonly id = "curling";
  readonly goalsToWin = POINTS_TO_WIN;
  readonly hud = { alarmGauge: false, standings: false };
  readonly shotSpeedScale = SHOT_SPEED_SCALE;

  private field!: CurlingField;
  private points: Record<TeamId, number> = { red: 0, yellow: 0 };
  private end = 1;
  /** 0-based index of the bot each team slides this turn. */
  private throwIndex = 0;
  private started = false;
  private clearMeasure?: () => void;

  buildField(scene: Phaser.Scene): void {
    this.points = { red: 0, yellow: 0 };
    this.end = 1;
    this.throwIndex = 0;
    this.started = false;
    this.clearMeasure = undefined;
    this.field = new CurlingField(scene);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return Array.from({ length: BOTZ_PER_TEAM }, () => ({ ...CIRCLE_CENTER[team] }));
  }

  canAim(bot: Bot): boolean {
    return !bot.eliminated && bot.index === this.throwIndex;
  }

  score(): Record<TeamId, number> {
    return { ...this.points };
  }

  onAimPhase(ctx: ModeContext): void {
    if (!this.started) {
      this.started = true;
      for (const b of ctx.bots) b.bench(ctx.scene);
    }
    for (const b of ctx.bots) {
      if (b.index === this.throwIndex && b.eliminated) {
        const c = CIRCLE_CENTER[b.team];
        b.revive(ctx.scene, c.x, c.y, false);
      }
    }
    const left = Math.max(0, BOTZ_PER_TEAM - this.throwIndex - 1);
    this.field.setRemaining({ red: left, yellow: left });
  }

  notice(): { text: string } {
    return { text: `Manche ${this.end} · Pierre ${Math.min(this.throwIndex + 1, BOTZ_PER_TEAM)}/${BOTZ_PER_TEAM}` };
  }

  /** After the last slide of the end, the house is measured and scored. */
  onSettled(ctx: ModeContext): { pauseMs: number } | null {
    this.throwIndex += 1;
    if (this.throwIndex < BOTZ_PER_TEAM) return null;

    const inPlay = ctx.bots.filter((b) => !b.eliminated).map((b) => ({ uid: b.uid, team: b.team, x: b.position.x, y: b.position.y }));
    const result = scoreCurlingEnd(HOUSE_CENTER, HOUSE_RADIUS, inPlay);
    if (result.winner) this.points[result.winner] += result.points;
    this.clearMeasure = this.field.showMeasure(HOUSE_CENTER, result);
    return { pauseMs: MEASURE_MS };
  }

  onResume(ctx: ModeContext): void {
    this.clearMeasure?.();
    this.clearMeasure = undefined;
    for (const b of ctx.bots) b.bench(ctx.scene);
    ctx.debris.clear();
    this.throwIndex = 0;
    this.end += 1;
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    const winner = (["red", "yellow"] as TeamId[]).find((t) => this.points[t] >= POINTS_TO_WIN);
    return winner ? { winner, score: this.score() } : null;
  }

  aiShots(ctx: ModeAIContext) {
    return PetanqueAI.computeShots({
      bots: ctx.bots,
      ownBots: ctx.ownBots,
      opponentBots: ctx.opponentBots,
      jack: HOUSE_CENTER,
      difficulty: ctx.difficulty,
      rng: ctx.rng,
    });
  }
}
