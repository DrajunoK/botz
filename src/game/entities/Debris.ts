import Phaser from "phaser";
import { Body } from "@/game/util/matter";
import { DEBRIS, PartId } from "@/config/parts";
import { DEBRIS_RADIUS } from "@/config/physics";
import { drawAntenna, drawArm, drawWheel } from "@/game/view/botArt";
import { Rng } from "@/game/Rng";


const ART_SCALE = 1.25;

/** Center of each part in bot-art units, so a fallen part spins around its own middle. */
const PART_CENTER: Record<PartId, { x: number; y: number }> = {
  antenna: { x: 2, y: -24 },
  armLeft: { x: -20.5, y: 3 },
  armRight: { x: 20.5, y: 3 },
  wheel: { x: 0, y: 16.5 },
};

/** A part that fell off a bot: a small physical body that can be pushed and acts as an obstacle. */
export class Debris {
  readonly body: MatterJS.BodyType;
  private readonly container: Phaser.GameObjects.Container;
  private fading = false;

  constructor(
    private readonly scene: Phaser.Scene,
    part: PartId,
    x: number,
    y: number,
    rng: Rng,
  ) {
    this.body = scene.matter.add.circle(x, y, DEBRIS_RADIUS, {
      restitution: DEBRIS.restitution,
      frictionAir: DEBRIS.frictionAir,
      friction: 0.05,
      density: DEBRIS.density,
      label: "debris",
    }) as MatterJS.BodyType;
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(DEBRIS.launchSpeedMin, DEBRIS.launchSpeedMax);
    Body.setVelocity(this.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    Body.setAngularVelocity(this.body, rng.spread(0.5) + (rng.next() < 0.5 ? 0.25 : -0.25));

    const g = scene.add.graphics();
    const c = PART_CENTER[part];
    g.setPosition(-c.x * ART_SCALE, -c.y * ART_SCALE).setScale(ART_SCALE);
    if (part === "antenna") drawAntenna(g);
    else if (part === "wheel") drawWheel(g);
    else drawArm(g, part === "armLeft" ? "left" : "right");
    this.container = scene.add.container(x, y, [g]).setDepth(6);
  }

  get speed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.y);
  }

  get isFading(): boolean {
    return this.fading;
  }

  syncVisuals(): void {
    this.container.setPosition(this.body.position.x, this.body.position.y).setRotation(this.body.angle);
  }

  /** Fades the piece out, then removes it from the world. */
  fadeOut(onDone: () => void): void {
    if (this.fading) return;
    this.fading = true;
    // Stop colliding right away: a ghost shouldn't block anyone.
    this.body.isSensor = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: DEBRIS.fadeOutMs,
      onComplete: () => {
        this.destroy();
        onDone();
      },
    });
  }

  destroy(): void {
    this.scene.matter.world.remove(this.body);
    this.container.destroy();
  }
}

/** Keeps the debris count bounded: beyond the cap, the oldest pieces fade away. */
export class DebrisField {
  private items: Debris[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {}

  spawn(part: PartId, x: number, y: number): void {
    this.items.push(new Debris(this.scene, part, x, y, this.rng));
    const alive = this.items.filter((d) => !d.isFading);
    for (let i = 0; i < alive.length - DEBRIS.maxCount; i++) {
      const old = alive[i];
      old.fadeOut(() => {
        this.items = this.items.filter((d) => d !== old);
      });
    }
  }

  /** Speeds of every piece still on the pitch (for the "everything has stopped" check). */
  speeds(): number[] {
    return this.items.filter((d) => !d.isFading).map((d) => d.speed);
  }

  syncVisuals(): void {
    for (const d of this.items) d.syncVisuals();
  }

  clear(): void {
    for (const d of this.items) d.destroy();
    this.items = [];
  }
}
