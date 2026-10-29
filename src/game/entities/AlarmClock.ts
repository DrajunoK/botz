import Phaser from "phaser";
import { Body } from "@/game/util/matter";
import { ALARM, PanicLevel } from "@/config/alarmClock";
import { CLOCK_RADIUS, FIXED_TIMESTEP_MS } from "@/config/physics";
import { RoundedRect, Vec2 } from "@/game/field/fieldGeometry";
import { computeFleeDirection } from "@/game/alarmSteering";
import { panicConfig } from "@/game/Panic";
import { AlarmClockView } from "@/game/view/AlarmClockView";
import { Rng } from "@/game/Rng";


/**
 * The ball: an alarm clock that runs away from the botz on its own during each resolution,
 * more frantically as the match goes on, and that a hard hit knocks silly for a moment.
 * Still an ordinary physics body: it can be pushed and bounces off walls and botz.
 */
export class AlarmClock {
  readonly body: MatterJS.BodyType;
  private readonly view: AlarmClockView;

  level: PanicLevel = 0;
  private running = false;
  private runEndsAtMs = 0;
  private stunEndsAtMs = 0;
  private fleeDir: Vec2 = { x: 1, y: 0 };
  private steerTimerMs = 0;
  private slowMs = 0;
  private handAngle = 0;
  private timeSec = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.matter.add.circle(x, y, CLOCK_RADIUS, {
      restitution: ALARM.restitution,
      friction: ALARM.friction,
      frictionAir: ALARM.frictionAir,
      density: ALARM.density,
      label: "alarm",
    }) as MatterJS.BodyType;
    Body.setInertia(this.body, Infinity);
    this.view = new AlarmClockView(scene);
  }

  get position(): Vec2 {
    return { x: this.body.position.x, y: this.body.position.y };
  }

  get speed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.y);
  }

  isStunned(nowMs: number): boolean {
    return nowMs < this.stunEndsAtMs;
  }

  /** True while the clock is propelling itself (resolution phase, not stunned). */
  isRunning(nowMs: number): boolean {
    return this.running && nowMs < this.runEndsAtMs && !this.isStunned(nowMs);
  }

  /** The resolution starts: the clock wakes up and bolts. */
  startRun(nowMs: number, level: PanicLevel): void {
    this.level = level;
    this.running = true;
    this.runEndsAtMs = nowMs + ALARM.runDurationMs;
    this.steerTimerMs = 0;
    this.slowMs = 0;
  }

  stopRun(): void {
    this.running = false;
  }

  /** A bot hit it hard: it stops ringing and running for a moment. */
  stun(nowMs: number): void {
    this.stunEndsAtMs = nowMs + ALARM.stunMs;
  }

  /** One fixed step of self-propulsion. */
  step(nowMs: number, bots: Vec2[], field: RoundedRect, rng: Rng): void {
    if (!this.isRunning(nowMs)) return;

    if (this.speed < ALARM.stuckSpeed) this.slowMs += FIXED_TIMESTEP_MS;
    else this.slowMs = 0;

    this.steerTimerMs -= FIXED_TIMESTEP_MS;
    if (this.steerTimerMs <= 0) {
      this.steerTimerMs = ALARM.steerPeriodMs;
      const stuck = this.slowMs >= ALARM.stuckAfterMs;
      if (stuck) this.slowMs = 0;
      this.fleeDir = computeFleeDirection({ clock: this.position, bots, field, stuck, rng });
    }

    const accel = panicConfig(this.level).fleeAccel;
    const v = this.body.velocity;
    Body.setVelocity(this.body, { x: v.x + this.fleeDir.x * accel, y: v.y + this.fleeDir.y * accel });
  }

  /** Puts the clock back at the kickoff spot, at rest and awake again. */
  placeAt(x: number, y: number): void {
    Body.setPosition(this.body, { x, y });
    Body.setVelocity(this.body, { x: 0, y: 0 });
    this.running = false;
    this.stunEndsAtMs = 0;
  }

  /** Level shown while aiming (the resolution sets it again when it starts). */
  setLevel(level: PanicLevel): void {
    this.level = level;
  }

  syncVisuals(nowMs: number, dtSec: number): void {
    this.timeSec += dtSec;
    const stunned = this.isStunned(nowMs);
    const cfg = panicConfig(this.level);
    if (!stunned) this.handAngle += cfg.handSpeed * dtSec;
    this.view.sync({
      x: this.body.position.x,
      y: this.body.position.y,
      level: this.level,
      time: this.timeSec,
      handAngle: this.handAngle,
      stunned,
      shake: stunned ? 0 : cfg.shake,
    });
  }

  destroy(): void {
    this.view.destroy();
  }
}
