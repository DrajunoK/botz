import Phaser from "phaser";
import { TeamId } from "@/config/game";
import {
  ARENA,
  BOLT_PHYSICS,
  BOLT_POOL,
  BOLT_RADIUS,
  GOLD_POOL,
  GOLD_RADIUS,
  GOLD_VALUE,
  MIRROR_X,
  REFILL_BELOW,
  REFILL_PAIRS,
  SPAWN_X,
  SPAWN_Y,
  START_PAIRS,
  TURNS,
  ZONE,
  mirrorX,
} from "@/config/boulons";
import { BOT_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { BoulonsField } from "@/game/field/BoulonsField";
import { inRect, pickBoltSpots } from "@/game/boulons";
import { Body } from "@/game/util/matter";
import { bodyText } from "@/ui/ui";

interface Bolt {
  body: MatterJS.BodyType;
  gold: boolean;
  onFloor: boolean;
}

const TEAMS: TeamId[] = ["red", "yellow"];
const CENTER = { x: MIRROR_X, y: (ARENA.top + ARENA.bottom) / 2 };

/**
 * Chasse aux boulons: bolts lie on the floor, botz push them into their own deposit zone. A bolt is
 * worth 1 point, the golden one in the middle 2. After 8 turns the team with more points wins; a tie
 * plays on until one team is ahead. Fresh bolts are dropped when the floor runs low.
 */
export class BoulonsMode implements GameMode {
  readonly id = "boulons";
  /** Unused: the game is decided by `checkWinner`. */
  readonly goalsToWin = 999;
  readonly hud = { alarmGauge: false, standings: false };

  private scene!: Phaser.Scene;
  private bolts: Bolt[] = [];
  private layer!: Phaser.GameObjects.Graphics;
  private points: Record<TeamId, number> = { red: 0, yellow: 0 };
  private turnsPlayed = 0;
  private started = false;

  buildField(scene: Phaser.Scene): void {
    this.scene = scene;
    this.points = { red: 0, yellow: 0 };
    this.turnsPlayed = 0;
    this.started = false;
    new BoulonsField(scene);
    this.bolts = [];
    for (let i = 0; i < BOLT_POOL + GOLD_POOL; i++) {
      const gold = i >= BOLT_POOL;
      const body = scene.matter.add.circle(-500, -500, gold ? GOLD_RADIUS : BOLT_RADIUS, { ...BOLT_PHYSICS, label: "bolt" }) as MatterJS.BodyType;
      Body.setInertia(body, Infinity);
      scene.matter.world.remove(body);
      this.bolts.push({ body, gold, onFloor: false });
    }
    this.layer = scene.add.graphics().setDepth(-4);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    const x = team === "red" ? SPAWN_X : mirrorX(SPAWN_X);
    return SPAWN_Y.map((y) => ({ x, y }));
  }

  score(): Record<TeamId, number> {
    return { ...this.points };
  }

  onAimPhase(ctx: ModeContext): void {
    const next = () => ctx.rng.next();
    const avoid = [...ctx.bots.filter((b) => !b.eliminated).map((b) => b.position), ...this.onFloor().map((b) => ({ x: b.body.position.x, y: b.body.position.y }))];
    if (!this.started) {
      this.started = true;
      this.drop(false, pickBoltSpots(next, START_PAIRS, [...avoid, CENTER]));
      this.drop(true, [CENTER]);
      return;
    }
    if (this.onFloor().filter((b) => !b.gold).length < REFILL_BELOW) {
      this.drop(false, pickBoltSpots(next, REFILL_PAIRS, [...avoid, CENTER]));
    }
    if (this.turnsPlayed % 3 === 0 && !this.bolts.some((b) => b.gold && b.onFloor)) this.drop(true, [CENTER]);
  }

  notice(): { text: string; warning?: boolean } {
    const left = this.onFloor().length;
    if (this.turnsPlayed >= TURNS) return { text: `Mort subite · ${left} boulons`, warning: true };
    return { text: `Tour ${this.turnsPlayed + 1}/${TURNS} · ${left} boulons en jeu` };
  }

  afterStep(): void {
    for (const bolt of this.onFloor()) {
      const { x, y } = bolt.body.position;
      const team = TEAMS.find((t) => inRect(ZONE[t], x, y));
      if (!team) continue;
      const value = bolt.gold ? GOLD_VALUE : 1;
      this.points[team] += value;
      this.take(bolt);
      this.popup(team, x, y, value, bolt.gold);
    }
  }

  onSettled(): null {
    this.turnsPlayed += 1;
    return null;
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    if (this.turnsPlayed < TURNS || this.points.red === this.points.yellow) return null;
    return { winner: this.points.red > this.points.yellow ? "red" : "yellow", score: this.score() };
  }

  extraSpeeds(): number[] {
    return this.onFloor().map((b) => Math.hypot(b.body.velocity.x, b.body.velocity.y));
  }

  syncVisuals(simTimeMs: number): void {
    const g = this.layer;
    g.clear();
    for (const b of this.onFloor()) {
      const { x, y } = b.body.position;
      const r = b.gold ? GOLD_RADIUS : BOLT_RADIUS;
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(x + 3, y + 5, r * 2.1, r * 1.7);
      if (b.gold) {
        const glow = 0.25 + 0.15 * Math.sin(simTimeMs / 220);
        g.fillStyle(0xffd24a, glow);
        g.fillCircle(x, y, r + 12);
      }
      this.hex(g, x, y, r, b.gold ? 0xffd24a : 0x6b7690, b.gold ? 0xb8861a : 0x2b2233);
      g.fillStyle(b.gold ? 0xfff3b8 : 0xaab3c8, 1);
      g.fillCircle(x, y, r * 0.42);
      g.lineStyle(2, b.gold ? 0xb8861a : 0x2b2233, 1);
      g.strokeCircle(x, y, r * 0.42);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(x - r * 0.45, y - r * 0.45, 2.4);
    }
  }

  /** Pushes the nearest loose bolt towards the AI's own zone, aiming at the spot just behind it. */
  aiShots(ctx: ModeAIContext) {
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const zone = ZONE[ctx.team];
    const goal = { x: (zone.left + zone.right) / 2, y: (zone.top + zone.bottom) / 2 };
    const free = this.onFloor().map((b) => ({ x: b.body.position.x, y: b.body.position.y, gold: b.gold }));
    return ctx.bots.map((bot) => {
      const near = [...free].sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) * (a.gold ? 0.6 : 1) - Math.hypot(b.x - bot.x, b.y - bot.y) * (b.gold ? 0.6 : 1))[0];
      const target = near
        ? (() => {
            const ux = goal.x - near.x;
            const uy = goal.y - near.y;
            const l = Math.hypot(ux, uy) || 1;
            const back = BOT_RADIUS + (near.gold ? GOLD_RADIUS : BOLT_RADIUS) + 2;
            free.splice(free.indexOf(near), 1); // another bot goes for a different bolt
            return { x: near.x - (ux / l) * back, y: near.y - (uy / l) * back };
          })()
        : goal;
      const angle = (ctx.rng() * 2 - 1) * noise.angleDeg * 0.5 * (Math.PI / 180);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const speed = Math.min(MAX_SHOT_SPEED, Math.max(8, MAX_SHOT_SPEED * (0.45 + Math.min(len, 600) / 1100) * (1 + (ctx.rng() * 2 - 1) * noise.power * 0.5)));
      return { botUid: bot.uid, vx: ((dx / len) * c - (dy / len) * s) * speed, vy: ((dx / len) * s + (dy / len) * c) * speed };
    });
  }

  // ───────────────────────────── bolts ─────────────────────────────

  private onFloor(): Bolt[] {
    return this.bolts.filter((b) => b.onFloor);
  }

  /** Puts bolts of the right kind back on the floor at `spots` (one per spot, as long as the pool has any left). */
  private drop(gold: boolean, spots: readonly { x: number; y: number }[]): void {
    for (const p of spots) {
      const bolt = this.bolts.find((b) => b.gold === gold && !b.onFloor);
      if (!bolt) return;
      bolt.onFloor = true;
      this.scene.matter.world.add(bolt.body);
      Body.setPosition(bolt.body, { x: p.x, y: p.y });
      Body.setVelocity(bolt.body, { x: 0, y: 0 });
      Body.setAngularVelocity(bolt.body, 0);
    }
  }

  private take(bolt: Bolt): void {
    bolt.onFloor = false;
    this.scene.matter.world.remove(bolt.body);
  }

  private popup(team: TeamId, x: number, y: number, value: number, gold: boolean): void {
    const color = team === "red" ? "#ff8a84" : "#f6c234";
    const text = this.scene.add
      .text(x, y - 20, `+${value}`, { ...bodyText(gold ? 44 : 34, color, "700"), stroke: "#141b31", strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(120);
    this.scene.tweens.add({ targets: text, y: y - 90, alpha: 0, duration: 900, ease: "Quad.Out", onComplete: () => text.destroy() });
  }

  private hex(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill: number, edge: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) pts.push({ x: x + Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r, y: y + Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r });
    g.fillStyle(fill, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, edge, 1);
    g.strokePoints(pts, true);
  }
}
