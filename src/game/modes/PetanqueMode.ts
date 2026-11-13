import Phaser from "phaser";
import { BOTZ_PER_TEAM, TeamId } from "@/config/game";
import { CIRCLE_CENTER, JACK_FRICTION_AIR, MEASURE_MS, POINTS_TO_WIN, SHOT_SPEED_SCALE } from "@/config/petanque";
import { BOT_RADIUS, CLOCK_RADIUS } from "@/config/physics";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { PetanqueField } from "@/game/field/PetanqueField";
import { AlarmClock } from "@/game/entities/AlarmClock";
import type { Bot } from "@/game/entities/Bot";
import { PetanqueAI } from "@/game/PetanqueAI";
import { scoreEnd } from "@/game/petanque";

/**
 * Pétanque: each end, both teams throw their 3 botz one at a time (simultaneously), then the botz
 * closest to the jack score. First to 3 points wins. The jack is a sleeping alarm clock that only
 * moves when something pushes it.
 */
export class PetanqueMode implements GameMode {
  readonly id = "petanque";
  readonly goalsToWin = POINTS_TO_WIN;
  readonly hud = { alarmGauge: false, standings: false };
  readonly shotSpeedScale = SHOT_SPEED_SCALE;

  private field!: PetanqueField;
  private jack!: AlarmClock;
  private points: Record<TeamId, number> = { red: 0, yellow: 0 };
  private end = 1;
  /** 0-based index of the bot each team throws this turn. */
  private throwIndex = 0;
  private started = false;
  private clearMeasure?: () => void;

  buildField(scene: Phaser.Scene): void {
    this.points = { red: 0, yellow: 0 };
    this.end = 1;
    this.throwIndex = 0;
    this.started = false;
    this.clearMeasure = undefined;
    this.field = new PetanqueField(scene);
    this.jack = new AlarmClock(scene, 0, 0);
    this.jack.body.frictionAir = JACK_FRICTION_AIR;
  }

  /** Every bot starts in its team's circle; the others wait out of play until their turn. */
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
      this.placeJack(ctx);
    }
    for (const b of ctx.bots) {
      if (b.index === this.throwIndex && b.eliminated) {
        const c = CIRCLE_CENTER[b.team];
        b.revive(ctx.scene, c.x, c.y, false);
      }
    }
    this.refreshRemaining();
  }

  notice(): { text: string } {
    return { text: `Mène ${this.end} · Lancer ${Math.min(this.throwIndex + 1, BOTZ_PER_TEAM)}/${BOTZ_PER_TEAM}` };
  }

  /** After each throw is resolved; after the last one, the end is measured and scored. */
  onSettled(ctx: ModeContext): { pauseMs: number } | null {
    this.throwIndex += 1;
    if (this.throwIndex < BOTZ_PER_TEAM) return null;

    const jack = this.jack.position;
    const inPlay = ctx.bots.filter((b) => !b.eliminated).map((b) => ({ uid: b.uid, team: b.team, x: b.position.x, y: b.position.y }));
    const result = scoreEnd(jack, inPlay, BOT_RADIUS, CLOCK_RADIUS);
    if (result.winner) this.points[result.winner] += result.points;
    this.clearMeasure = this.field.showMeasure(jack, result);
    return { pauseMs: MEASURE_MS };
  }

  /** The measuring is over: sweep the court and start the next end. */
  onResume(ctx: ModeContext): void {
    this.clearMeasure?.();
    this.clearMeasure = undefined;
    for (const b of ctx.bots) b.bench(ctx.scene);
    ctx.debris.clear();
    this.placeJack(ctx);
    this.throwIndex = 0;
    this.end += 1;
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    const winner = (["red", "yellow"] as TeamId[]).find((t) => this.points[t] >= POINTS_TO_WIN);
    return winner ? { winner, score: this.score() } : null;
  }

  extraSpeeds(): number[] {
    return [this.jack.speed];
  }

  syncVisuals(simTimeMs: number, dtSec: number): void {
    this.jack.syncVisuals(simTimeMs, dtSec);
  }

  aiShots(ctx: ModeAIContext) {
    return PetanqueAI.computeShots({
      bots: ctx.bots,
      ownBots: ctx.ownBots,
      opponentBots: ctx.opponentBots,
      jack: this.jack.position,
      difficulty: ctx.difficulty,
      rng: ctx.rng,
    });
  }

  private placeJack(ctx: ModeContext): void {
    const p = PetanqueField.randomJackPosition(ctx.rng);
    this.jack.placeAt(p.x, p.y);
  }

  /** Icons by the circles: the botz each team still has to throw this end. */
  private refreshRemaining(): void {
    const left = BOTZ_PER_TEAM - this.throwIndex - 1;
    this.field.setRemaining({ red: Math.max(0, left), yellow: Math.max(0, left) });
  }
}
