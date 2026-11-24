import Phaser from "phaser";
import { Body } from "@/game/util/matter";
import { PIN_PHYSICS, PIN_RADIUS } from "@/config/bowling";
import { Spot, knockedIndexes } from "@/game/bowling";

/** The ten pins of one lane. Pins that fell leave the physics world until the rack is set up again. */
export class PinRack {
  private readonly bodies: MatterJS.BodyType[];
  private readonly inPlay: boolean[];

  spots: readonly Spot[];

  constructor(private readonly scene: Phaser.Scene, spots: readonly Spot[]) {
    this.spots = spots;
    this.bodies = spots.map((s) => {
      const body = scene.matter.add.circle(s.x, s.y, PIN_RADIUS, { ...PIN_PHYSICS, label: "pin" }) as MatterJS.BodyType;
      Body.setInertia(body, Infinity);
      return body;
    });
    this.inPlay = spots.map(() => true);
  }

  /** Pins still in the world, as `[index, body]`. */
  private active(): [number, MatterJS.BodyType][] {
    return this.bodies.map((b, i) => [i, b] as [number, MatterJS.BodyType]).filter(([i]) => this.inPlay[i]);
  }

  standing(): number {
    return this.inPlay.filter(Boolean).length;
  }

  /** Spots of the pins that are still up and have not been moved (what the AI aims at). */
  standingSpots(): Spot[] {
    return this.spots.filter((_, i) => this.inPlay[i]);
  }

  /** Indexes of the pins that fell during the last throw. */
  knocked(): number[] {
    const positions = this.bodies.map((b, i) => (this.inPlay[i] ? { x: b.position.x, y: b.position.y } : null));
    return knockedIndexes(this.spots, positions).filter((i) => this.inPlay[i]);
  }

  speeds(): number[] {
    return this.active().map(([, b]) => Math.hypot(b.velocity.x, b.velocity.y));
  }

  /** After a throw: the fallen pins are cleared away and the others go back on their spots. */
  clearKnocked(fallen: readonly number[]): void {
    for (const i of fallen) this.take(i);
    for (const [i, b] of this.active()) this.place(b, this.spots[i]);
  }

  /** Changes where the ten pins stand; call `reset()` afterwards to put them there. */
  setSpots(spots: readonly Spot[]): void {
    this.spots = spots;
  }

  /** A fresh rack of ten. */
  reset(): void {
    this.bodies.forEach((b, i) => {
      if (!this.inPlay[i]) {
        this.inPlay[i] = true;
        this.scene.matter.world.add(b);
      }
      this.place(b, this.spots[i]);
    });
  }

  private take(i: number): void {
    if (!this.inPlay[i]) return;
    this.inPlay[i] = false;
    this.scene.matter.world.remove(this.bodies[i]);
  }

  private place(b: MatterJS.BodyType, s: Spot): void {
    Body.setPosition(b, { x: s.x, y: s.y });
    Body.setVelocity(b, { x: 0, y: 0 });
    Body.setAngularVelocity(b, 0);
    Body.setAngle(b, 0);
  }

  /** Draws every pin in play: upright, or lying down once knocked off its spot. */
  draw(g: Phaser.GameObjects.Graphics, goldIndex = -1): void {
    const order = this.active().sort((p, q) => p[1].position.y - q[1].position.y);
    for (const [i, b] of order) {
      const spot = this.spots[i];
      const dx = b.position.x - spot.x;
      const dy = b.position.y - spot.y;
      const moved = Math.hypot(dx, dy);
      const gold = i === goldIndex;
      if (moved < 9) this.drawStanding(g, b.position.x, b.position.y, gold);
      else this.drawFallen(g, b.position.x, b.position.y, Math.atan2(dy, dx), gold);
    }
  }

  /** An upright pin seen from a little above: belly, neck with a red band, and a round head. */
  private drawStanding(g: Phaser.GameObjects.Graphics, x: number, y: number, gold: boolean): void {
    const edge = 0x2b2233;
    const body = gold ? 0xffd24a : 0xf8f4ea;
    const band = gold ? 0x9a6a10 : 0xd63a33;
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(x + 4, y + 12, 32, 13);
    // belly
    g.fillStyle(body, 1);
    g.fillEllipse(x, y + 1, 30, 34);
    g.lineStyle(2.5, edge, 1);
    g.strokeEllipse(x, y + 1, 30, 34);
    // neck
    g.fillStyle(body, 1);
    g.fillEllipse(x, y - 14, 15, 18);
    g.lineStyle(2.5, edge, 1);
    g.strokeEllipse(x, y - 14, 15, 18);
    // red bands
    g.fillStyle(band, 1);
    g.fillEllipse(x, y - 13, 15, 6);
    g.fillEllipse(x, y - 5, 22, 6);
    // head
    g.fillStyle(body, 1);
    g.fillCircle(x, y - 25, 7.5);
    g.lineStyle(2.5, edge, 1);
    g.strokeCircle(x, y - 25, 7.5);
    // shine
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(x - 6, y + 4, 4, 14);
  }

  private drawFallen(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, gold: boolean): void {
    const half = PIN_RADIUS * 1.25;
    const w = PIN_RADIUS * 0.62;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const p = (u: number, v: number) => ({ x: x + u * cos - v * sin, y: y + u * sin + v * cos });
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x + 3, y + 5, half * 2, w * 2.2);
    g.fillStyle((gold ? 0xf0c040 : 0xe9e2d2), 1);
    g.fillPoints([p(-half, -w), p(half, -w * 0.6), p(half, w * 0.6), p(-half, w)], true);
    g.fillCircle(p(-half, 0).x, p(-half, 0).y, w);
    g.fillCircle(p(half, 0).x, p(half, 0).y, w * 0.62);
    g.lineStyle(2, 0x2b2233, 1);
    g.strokePoints([p(-half, -w), p(half, -w * 0.6), p(half, w * 0.6), p(-half, w)], true);
    g.fillStyle(gold ? 0x9a6a10 : 0xd63a33, 1);
    g.fillPoints([p(half * 0.2, -w * 0.8), p(half * 0.5, -w * 0.72), p(half * 0.5, w * 0.72), p(half * 0.2, w * 0.8)], true);
  }
}
