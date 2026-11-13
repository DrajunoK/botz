import Phaser from "phaser";
import { Body } from "@/game/util/matter";
import { TeamId, TEAM_COLORS } from "@/config/game";
import { BOT_RADIUS, BOT_PHYSICS, FIXED_TIMESTEP_MS } from "@/config/physics";
import { PARTS, PartId } from "@/config/parts";
import { BotParts } from "@/game/entities/BotParts";
import { BotView } from "@/game/view/BotView";
import { Rng } from "@/game/Rng";


let nextBotUid = 1;

/**
 * A round robot ("botz"). Owns the Matter body and its parts; all drawing is delegated
 * to BotView. Parts that fall off make it lighter, bend its trajectory or blur its aim.
 */
export class Bot {
  readonly uid: number;
  readonly team: TeamId;
  readonly index: number;
  readonly parts = new BotParts();
  readonly body: MatterJS.BodyType;
  /** Whether this bot currently has an aim arrow assigned for the upcoming resolution. */
  hasAim = false;
  /** True while the bot is out of play: fallen in the lava (Survivant) or waiting its turn (Pétanque). */
  eliminated = false;

  private readonly view: BotView;
  private readonly baseMass: number;
  private spin = 0;
  private dragMultiplier = 1;
  private dragRerollMs = 0;

  constructor(scene: Phaser.Scene, team: TeamId, index: number, x: number, y: number) {
    this.uid = nextBotUid++;
    this.team = team;
    this.index = index;

    this.body = scene.matter.add.circle(x, y, BOT_RADIUS, {
      restitution: BOT_PHYSICS.restitution,
      friction: BOT_PHYSICS.friction,
      frictionAir: BOT_PHYSICS.frictionAir,
      density: BOT_PHYSICS.density,
      label: `bot-${team}-${index}`,
    }) as MatterJS.BodyType;
    Body.setInertia(this.body, Infinity); // art is rotated for the spin gag only, physics never rotates
    this.baseMass = this.body.mass;
    (this.body as unknown as { botUid: number }).botUid = this.uid;

    this.view = new BotView(scene, TEAM_COLORS[team]);
    this.view.setParts(this.parts);
  }

  get position(): { x: number; y: number } {
    return { x: this.body.position.x, y: this.body.position.y };
  }

  get speed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.y);
  }

  /**
   * Launches the bot from its arrow. `vx, vy` is the player's intent; the actual velocity is
   * bent by the missing parts (aim error) and boosted by the weight lost.
   */
  applyShot(vx: number, vy: number, rng: Rng): void {
    const error = this.parts.aimErrorRad(rng);
    const cos = Math.cos(error);
    const sin = Math.sin(error);
    const mult = this.parts.shotSpeedMultiplier;
    Body.setVelocity(this.body, { x: (vx * cos - vy * sin) * mult, y: (vx * sin + vy * cos) * mult });
  }

  /** Advances part-dependent motion by one fixed step while bodies are in play. */
  stepMotion(rng: Rng): void {
    const speed = this.speed;

    // Missing arms: the heading slowly curves.
    const drift = this.parts.driftRate;
    if (drift !== 0 && speed > PARTS.driftMinSpeed) {
      const a = (drift * FIXED_TIMESTEP_MS) / 1000;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const { x, y } = this.body.velocity;
      Body.setVelocity(this.body, { x: x * c - y * s, y: x * s + y * c });
    }

    // Missing wheel: irregular braking.
    if (!this.parts.has("wheel")) {
      this.dragRerollMs -= FIXED_TIMESTEP_MS;
      if (this.dragRerollMs <= 0) {
        this.dragRerollMs = PARTS.wheelDragPeriodMs;
        this.dragMultiplier = rng.range(PARTS.wheelDragMin, PARTS.wheelDragMax);
      }
      this.body.frictionAir = BOT_PHYSICS.frictionAir * this.dragMultiplier;
      this.spin += PARTS.wheelSpinPerSpeed * speed * (FIXED_TIMESTEP_MS / 1000);
    }
  }

  /**
   * Takes the bot out of the game: it keeps sliding for the fall animation but no longer collides,
   * then leaves the physics world.
   */
  eliminate(scene: Phaser.Scene, fallMs: number): void {
    if (this.eliminated) return;
    this.eliminated = true;
    this.hasAim = false;
    this.body.isSensor = true;
    this.view.fall(scene, fallMs);
    scene.time.delayedCall(fallMs, () => {
      if (this.eliminated) scene.matter.world.remove(this.body);
    });
  }

  /** Sets the bot aside at once: no body, no picture, until `revive`. */
  bench(scene: Phaser.Scene): void {
    this.eliminated = true;
    this.hasAim = false;
    this.body.isSensor = true;
    scene.matter.world.remove(this.body);
    this.view.setVisible(false);
  }

  /** Brings an out-of-play bot back at (x, y), repaired unless `repair` is false. */
  revive(scene: Phaser.Scene, x: number, y: number, repair = true): void {
    if (!this.eliminated) return;
    this.eliminated = false;
    this.body.isSensor = false;
    scene.matter.world.add(this.body);
    if (repair) this.repair();
    this.placeAt(x, y);
    this.view.reset();
  }

  /** A part fell off: lighten the body and redraw. */
  onPartLost(_part: PartId): void {
    Body.setMass(this.body, this.baseMass * this.parts.massFactor);
    this.view.setParts(this.parts);
  }

  repair(): void {
    this.parts.repair();
    Body.setMass(this.body, this.baseMass);
    this.body.frictionAir = BOT_PHYSICS.frictionAir;
    this.spin = 0;
    this.view.setParts(this.parts);
  }

  /** Puts the bot back at a kickoff spot, at rest. */
  placeAt(x: number, y: number): void {
    Body.setPosition(this.body, { x, y });
    Body.setVelocity(this.body, { x: 0, y: 0 });
    Body.setAngularVelocity(this.body, 0);
    this.spin = 0;
  }

  /** Re-renders at the current physics position. Call every frame. */
  syncVisuals(timeSec: number): void {
    this.view.sync(this.body.position.x, this.body.position.y, this.spin, timeSec);
  }

  destroy(): void {
    this.view.destroy();
  }
}
