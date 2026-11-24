import Phaser from "phaser";
import { TeamId } from "@/config/game";
import {
  ARENA,
  BLAST_PUSH,
  BLAST_RADIUS,
  BOLT_FALL_MARGIN,
  BOLT_PHYSICS,
  BOLT_POOL,
  BOLT_RADIUS,
  BOMB_FALL_MARGIN,
  BOMB_PHYSICS,
  BOMB_RADIUS,
  BOMB_RETURN_TURNS,
  BOMB_SPOT,
  BOT_FALL_MARGIN,
  EJECT_SPEED_MAX,
  EJECT_SPEED_MIN,
  GOLD_POOL,
  GOLD_RADIUS,
  GOLD_SPOT,
  GOLD_VALUE,
  PILE_MAX,
  PILE_RADIUS,
  PIT,
  PIT_FLOOR_OFFSET,
  EJECT_IMMUNE_STEPS,
  REFILL_BELOW,
  REFILL_PAIRS,
  SPAWN_X,
  SPAWN_Y,
  START_PAIRS,
  TURNS,
  mirrorX,
} from "@/config/boulons";
import { BOT_PHYSICS, BOT_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { BoulonsField } from "@/game/field/BoulonsField";
import { inPit, pickBoltSpots, pileSpot } from "@/game/boulons";
import { SFX } from "@/game/Audio";
import { Body } from "@/game/util/matter";
import { bodyText, titleText } from "@/ui/ui";

type BoltState = "pool" | "floor" | "pit";
interface Bolt {
  body: MatterJS.BodyType;
  gold: boolean;
  state: BoltState;
  /** Whose pit it lies in, when `state` is "pit". */
  pit?: TeamId;
  /** Steps left during which the pits ignore it (just thrown out by a bomb). */
  immune: number;
}

const TEAMS: TeamId[] = ["red", "yellow"];
const FALL_MS = 300;
const CENTER = { x: mirrorX(0) / 2, y: (ARENA.top + ARENA.bottom) / 2 };
const isHex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/**
 * Chasse aux boulons: bolts lie on a steel floor with a pit on each side. Push them into your own
 * pit; they stay visible down there and count while they are there (1 each, the golden one 2). Botz
 * can fall in too and sit the next turn out. The bomb, pushed into a pit, throws all that pit's
 * bolts back onto the floor. After 10 turns the pit with more points wins; a tie plays on.
 */
export class BoulonsMode implements GameMode {
  readonly id = "boulons";
  /** Unused: the game is decided by `checkWinner`. */
  readonly goalsToWin = 999;
  readonly hud = { alarmGauge: false, standings: false };

  private scene!: Phaser.Scene;
  private bolts: Bolt[] = [];
  private bomb!: MatterJS.BodyType;
  private bombOnFloor = false;
  private bombBackAtTurn = 0;
  private layer!: Phaser.GameObjects.Graphics;
  private labels!: Record<TeamId, Phaser.GameObjects.Text>;
  private turnsPlayed = 0;
  private started = false;

  buildField(scene: Phaser.Scene): void {
    this.scene = scene;
    this.turnsPlayed = 0;
    this.started = false;
    this.bombOnFloor = false;
    this.bombBackAtTurn = 0;
    new BoulonsField(scene);
    this.bolts = [];
    for (let i = 0; i < BOLT_POOL + GOLD_POOL; i++) {
      const gold = i >= BOLT_POOL;
      const body = scene.matter.add.circle(-500, -500, gold ? GOLD_RADIUS : BOLT_RADIUS, { ...BOLT_PHYSICS, label: "bolt" }) as MatterJS.BodyType;
      Body.setInertia(body, Infinity);
      scene.matter.world.remove(body);
      this.bolts.push({ body, gold, state: "pool", immune: 0 });
    }
    this.bomb = scene.matter.add.circle(-500, -500, BOMB_RADIUS, { ...BOMB_PHYSICS, label: "bomb" }) as MatterJS.BodyType;
    Body.setInertia(this.bomb, Infinity);
    scene.matter.world.remove(this.bomb);
    this.layer = scene.add.graphics().setDepth(-4);
    this.labels = {
      red: this.makeLabel("red"),
      yellow: this.makeLabel("yellow"),
    };
  }

  private makeLabel(team: TeamId): Phaser.GameObjects.Text {
    const p = PIT[team];
    return this.scene.add
      .text(p.x, p.y - p.r - 36, "0", titleText(40, isHex(team === "red" ? 0xff8a84 : 0xf6c234)))
      .setOrigin(0.5)
      .setDepth(-3)
      .setStroke("#141b31", 7);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    const x = team === "red" ? SPAWN_X : mirrorX(SPAWN_X);
    return SPAWN_Y.map((y) => ({ x, y }));
  }

  /** What each team's pit holds right now. */
  score(): Record<TeamId, number> {
    const out: Record<TeamId, number> = { red: 0, yellow: 0 };
    for (const b of this.bolts) if (b.state === "pit" && b.pit) out[b.pit] += b.gold ? GOLD_VALUE : 1;
    return out;
  }

  onAimPhase(ctx: ModeContext): void {
    const next = () => ctx.rng.next();
    // A bot that fell in last turn is back on its own side.
    for (const b of ctx.bots) {
      if (!b.eliminated) continue;
      const spawn = this.botSpawns(b.team)[b.index];
      b.revive(ctx.scene, spawn.x, spawn.y, false);
    }
    const busy = () => [...ctx.bots.filter((b) => !b.eliminated).map((b) => b.position), ...this.onFloor().map((b) => ({ x: b.body.position.x, y: b.body.position.y })), ...(this.bombOnFloor ? [{ x: this.bomb.position.x, y: this.bomb.position.y }] : [])];

    if (!this.started) {
      this.started = true;
      this.drop(false, pickBoltSpots(next, START_PAIRS, [...busy(), GOLD_SPOT, BOMB_SPOT]));
      this.drop(true, [GOLD_SPOT]);
      this.placeBomb(BOMB_SPOT);
      return;
    }
    if (this.onFloor().filter((b) => !b.gold).length < REFILL_BELOW) {
      this.drop(false, pickBoltSpots(next, REFILL_PAIRS, [...busy(), GOLD_SPOT, BOMB_SPOT]));
    }
    if (this.turnsPlayed % 3 === 0 && !this.bolts.some((b) => b.gold && b.state !== "pool")) this.drop(true, [GOLD_SPOT]);
    if (!this.bombOnFloor && this.turnsPlayed >= this.bombBackAtTurn) {
      const free = [BOMB_SPOT, GOLD_SPOT, CENTER].find((p) => busy().every((o) => Math.hypot(o.x - p.x, o.y - p.y) > 70));
      if (free) this.placeBomb(free);
    }
  }

  notice(): { text: string; warning?: boolean } {
    if (this.turnsPlayed >= TURNS) return { text: "Mort subite · le plus de boulons en fosse", warning: true };
    return { text: `Tour ${this.turnsPlayed + 1}/${TURNS} · ${this.onFloor().length} boulons au sol` };
  }

  afterStep(ctx: ModeContext): void {
    for (const bolt of this.onFloor()) {
      if (bolt.immune > 0) {
        bolt.immune -= 1;
        continue;
      }
      const { x, y } = bolt.body.position;
      const team = TEAMS.find((t) => inPit(PIT[t], x, y, BOLT_FALL_MARGIN));
      if (team) this.fall(bolt, team, x, y);
    }
    if (this.bombOnFloor) {
      const { x, y } = this.bomb.position;
      const team = TEAMS.find((t) => inPit(PIT[t], x, y, BOMB_FALL_MARGIN));
      if (team) this.explode(ctx, team);
    }
    for (const bot of ctx.bots) {
      if (bot.eliminated) continue;
      const { x, y } = bot.position;
      if (TEAMS.some((t) => inPit(PIT[t], x, y, BOT_FALL_MARGIN))) {
        bot.eliminate(ctx.scene, FALL_MS);
        SFX.playImpact(0.6);
        this.popup(x, y, "SPLASH !", "#ffffff", 30);
      }
    }
  }

  onSettled(): null {
    this.turnsPlayed += 1;
    return null;
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    const score = this.score();
    if (this.turnsPlayed < TURNS || score.red === score.yellow) return null;
    return { winner: score.red > score.yellow ? "red" : "yellow", score };
  }

  extraSpeeds(): number[] {
    const speeds = this.onFloor().map((b) => Math.hypot(b.body.velocity.x, b.body.velocity.y));
    if (this.bombOnFloor) speeds.push(Math.hypot(this.bomb.velocity.x, this.bomb.velocity.y));
    return speeds;
  }

  // ───────────────────────────── drawing ─────────────────────────────

  syncVisuals(simTimeMs: number): void {
    const g = this.layer;
    g.clear();
    const score = this.score();
    for (const t of TEAMS) {
      const text = String(score[t]);
      if (this.labels[t].text !== text) this.labels[t].setText(text);
    }
    // Bolts lying at the bottom of the pits, a little darker than the ones on the floor.
    for (const t of TEAMS) {
      const pit = PIT[t];
      this.bolts
        .filter((b) => b.state === "pit" && b.pit === t)
        .forEach((b, i) => {
          const s = pileSpot(i, PILE_RADIUS, PILE_MAX);
          this.drawBolt(g, pit.x + PIT_FLOOR_OFFSET.x + s.x, pit.y + PIT_FLOOR_OFFSET.y + s.y, b.gold, 1.05, true);
        });
    }
    for (const b of this.onFloor()) this.drawBolt(g, b.body.position.x, b.body.position.y, b.gold, 1, false, simTimeMs);
    if (this.bombOnFloor) this.drawBomb(g, this.bomb.position.x, this.bomb.position.y, simTimeMs);
  }

  private drawBolt(g: Phaser.GameObjects.Graphics, x: number, y: number, gold: boolean, scale: number, inPitView: boolean, simTimeMs = 0): void {
    const r = (gold ? GOLD_RADIUS : BOLT_RADIUS) * scale;
    if (!inPitView) {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(x + 3, y + 5, r * 2.1, r * 1.7);
    }
    if (gold && !inPitView) {
      g.fillStyle(0xffd24a, 0.25 + 0.15 * Math.sin(simTimeMs / 220));
      g.fillCircle(x, y, r + 12);
    }
    const fill = gold ? 0xffd24a : inPitView ? 0x7a85a6 : 0x6b7690;
    const edge = gold ? 0xb8861a : 0x2b2233;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) pts.push({ x: x + Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r, y: y + Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r });
    g.fillStyle(fill, 1);
    g.fillPoints(pts, true);
    g.lineStyle(inPitView ? 2 : 3, edge, 1);
    g.strokePoints(pts, true);
    g.fillStyle(gold ? 0xfff3b8 : 0xaab3c8, inPitView ? 0.8 : 1);
    g.fillCircle(x, y, r * 0.42);
    g.lineStyle(2, edge, 1);
    g.strokeCircle(x, y, r * 0.42);
    if (!inPitView) {
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(x - r * 0.45, y - r * 0.45, 2.4);
    }
  }

  private drawBomb(g: Phaser.GameObjects.Graphics, x: number, y: number, simTimeMs: number): void {
    const r = BOMB_RADIUS;
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x + 4, y + 7, r * 2.2, r * 1.8);
    g.fillStyle(0x1b1f2e, 1);
    g.fillCircle(x, y, r);
    g.lineStyle(3, 0x000000, 1);
    g.strokeCircle(x, y, r);
    g.fillStyle(0xd63a33, 1);
    g.fillRect(x - r + 4, y - 3, (r - 4) * 2, 6);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(x - r * 0.4, y - r * 0.4, 4);
    // Fuse and a flickering spark.
    g.lineStyle(4, 0xb8a27a, 1);
    g.lineBetween(x + r * 0.5, y - r * 0.7, x + r * 0.9, y - r * 1.25);
    const flick = 0.6 + 0.4 * Math.sin(simTimeMs / 70);
    g.fillStyle(0xffb547, flick);
    g.fillCircle(x + r * 0.95, y - r * 1.3, 6);
    g.fillStyle(0xffffff, flick);
    g.fillCircle(x + r * 0.95, y - r * 1.3, 2.8);
  }

  // ───────────────────────────── AI ─────────────────────────────

  /**
   * Pushes the nearest loose bolt towards the AI's own pit (the bomb towards the opponent's pit when it
   * holds a good pile), aiming at the spot just behind it, and eases off so the botz do not slide in too.
   */
  aiShots(ctx: ModeAIContext) {
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const own = PIT[ctx.team];
    const oppTeam: TeamId = ctx.team === "red" ? "yellow" : "red";
    const opp = PIT[oppTeam];
    const oppPile = this.score()[oppTeam];
    const free = this.onFloor().map((b) => ({ x: b.body.position.x, y: b.body.position.y, gold: b.gold, bomb: false }));
    if (this.bombOnFloor && oppPile >= 3) free.push({ x: this.bomb.position.x, y: this.bomb.position.y, gold: false, bomb: true });
    const f = BOT_PHYSICS.frictionAir;
    const travel = (v: number) => (v * (1 - f)) / f;

    return ctx.bots.map((bot) => {
      // Close to the botz and close to the pit it is going to: the short shots are the reliable ones.
      const cost = (t: { x: number; y: number; gold: boolean; bomb: boolean }) => {
        const dest = t.bomb ? opp : own;
        return (Math.hypot(t.x - bot.x, t.y - bot.y) + 1.4 * Math.hypot(t.x - dest.x, t.y - dest.y)) * (t.bomb ? 0.6 : t.gold ? 0.7 : 1);
      };
      const near = [...free].sort((a, b) => cost(a) - cost(b))[0];
      let target: { x: number; y: number } = { x: own.x, y: own.y };
      let reach = 400;
      if (near) {
        const dest = near.bomb ? opp : own;
        const ux = dest.x - near.x;
        const uy = dest.y - near.y;
        const l = Math.hypot(ux, uy) || 1;
        const back = BOT_RADIUS + (near.bomb ? BOMB_RADIUS : near.gold ? GOLD_RADIUS : BOLT_RADIUS) + 2;
        target = { x: near.x - (ux / l) * back, y: near.y - (uy / l) * back };
        reach = Math.hypot(target.x - bot.x, target.y - bot.y) + 90;
        free.splice(free.indexOf(near), 1); // another bot goes for a different one
      }
      const angle = (ctx.rng() * 2 - 1) * noise.angleDeg * 0.35 * (Math.PI / 180);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const ux = (dx / len) * c - (dy / len) * s;
      const uy = (dx / len) * s + (dy / len) * c;
      let speed = Math.min(MAX_SHOT_SPEED, Math.max(8, (reach * f) / (1 - f)) * (1 + (ctx.rng() * 2 - 1) * noise.power * 0.5));
      // Do not slide into a pit: shorten the shot until the botz would stop clear of both.
      const lands = (v: number) => ({ x: bot.x + ux * travel(v), y: bot.y + uy * travel(v) });
      while (speed > 8 && TEAMS.some((t) => inPit(PIT[t], lands(speed).x, lands(speed).y, -(BOT_RADIUS + 12)))) speed *= 0.88;
      return { botUid: bot.uid, vx: ux * speed, vy: uy * speed };
    });
  }

  // ───────────────────────────── bolts, pits, bomb ─────────────────────────────

  private onFloor(): Bolt[] {
    return this.bolts.filter((b) => b.state === "floor");
  }

  /** Puts bolts of the right kind from the pool on the floor at `spots`. */
  private drop(gold: boolean, spots: readonly { x: number; y: number }[]): void {
    for (const p of spots) {
      const bolt = this.bolts.find((b) => b.gold === gold && b.state === "pool");
      if (!bolt) return;
      this.putOnFloor(bolt, p.x, p.y, 0, 0);
    }
  }

  private putOnFloor(bolt: Bolt, x: number, y: number, vx: number, vy: number): void {
    bolt.state = "floor";
    bolt.pit = undefined;
    bolt.immune = 0;
    this.scene.matter.world.add(bolt.body);
    Body.setPosition(bolt.body, { x, y });
    Body.setVelocity(bolt.body, { x: vx, y: vy });
    Body.setAngularVelocity(bolt.body, 0);
  }

  private placeBomb(p: { x: number; y: number }): void {
    this.bombOnFloor = true;
    this.scene.matter.world.add(this.bomb);
    Body.setPosition(this.bomb, { x: p.x, y: p.y });
    Body.setVelocity(this.bomb, { x: 0, y: 0 });
    Body.setAngularVelocity(this.bomb, 0);
  }

  /** A bolt dropped into a pit: it leaves the floor and joins the pile. */
  private fall(bolt: Bolt, team: TeamId, x: number, y: number): void {
    bolt.state = "pit";
    bolt.pit = team;
    this.scene.matter.world.remove(bolt.body);
    this.dropAnimation(x, y, team, bolt.gold);
    this.popup(x, y, `+${bolt.gold ? GOLD_VALUE : 1}`, isHex(team === "red" ? 0xff8a84 : 0xf6c234), bolt.gold ? 44 : 34);
  }

  /** The bomb fell into a pit: that pit's bolts fly back out, and everything near is shoved away. */
  private explode(ctx: ModeContext, team: TeamId): void {
    const pit = PIT[team];
    this.bombOnFloor = false;
    this.bombBackAtTurn = this.turnsPlayed + BOMB_RETURN_TURNS;
    this.scene.matter.world.remove(this.bomb);

    // They fly out towards the middle of the arena (the pit sits against a wall), starting on the rim.
    const towards = team === "red" ? 0 : Math.PI;
    for (const bolt of this.bolts.filter((b) => b.state === "pit" && b.pit === team)) {
      const a = towards + (ctx.rng.next() * 2 - 1) * 1.3;
      const v = EJECT_SPEED_MIN + ctx.rng.next() * (EJECT_SPEED_MAX - EJECT_SPEED_MIN);
      this.putOnFloor(bolt, pit.x + Math.cos(a) * (pit.r + 18), pit.y + Math.sin(a) * (pit.r + 18), Math.cos(a) * v, Math.sin(a) * v);
      bolt.immune = EJECT_IMMUNE_STEPS;
    }
    const shove = (body: MatterJS.BodyType) => {
      const dx = body.position.x - pit.x;
      const dy = body.position.y - pit.y;
      const d = Math.hypot(dx, dy);
      if (d > BLAST_RADIUS || d < 1) return;
      const k = (BLAST_PUSH * (1 - d / BLAST_RADIUS)) / d;
      Body.setVelocity(body, { x: body.velocity.x + dx * k, y: body.velocity.y + dy * k });
    };
    for (const b of ctx.bots) if (!b.eliminated) shove(b.body);
    for (const b of this.onFloor()) shove(b.body);

    SFX.playImpact(1);
    this.scene.cameras.main.shake(260, 0.006);
    const flash = this.scene.add.circle(pit.x, pit.y, 40, 0xffb547, 0.9).setDepth(110);
    this.scene.tweens.add({ targets: flash, scale: BLAST_RADIUS / 40, alpha: 0, duration: 500, ease: "Quad.Out", onComplete: () => flash.destroy() });
    this.popup(pit.x, pit.y - 10, "BOUM !", "#ffffff", 56);
  }

  /** The bolt tumbles down the hole: it spins, shrinks and darkens, and a ripple spreads at the rim. */
  private dropAnimation(x: number, y: number, team: TeamId, gold: boolean): void {
    const pit = PIT[team];
    const r = gold ? GOLD_RADIUS : BOLT_RADIUS;
    const g = this.scene.add.graphics().setDepth(104).setPosition(x, y);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) pts.push({ x: Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r, y: Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r });
    g.fillStyle(gold ? 0xffd24a : 0x6b7690, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, 0x2b2233, 1);
    g.strokePoints(pts, true);
    this.scene.tweens.add({
      targets: g,
      x: pit.x + PIT_FLOOR_OFFSET.x * 0.6,
      y: pit.y + PIT_FLOOR_OFFSET.y * 0.6,
      scale: 0.35,
      angle: 400,
      alpha: 0.15,
      duration: 420,
      ease: "Cubic.In",
      onComplete: () => g.destroy(),
    });
    const ring = this.scene.add.circle(pit.x, pit.y, pit.r * 0.5, 0xffffff, 0).setStrokeStyle(4, 0xffffff, 0.7).setDepth(103);
    this.scene.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 520, delay: 250, ease: "Quad.Out", onComplete: () => ring.destroy() });
  }

  private popup(x: number, y: number, label: string, color: string, size: number): void {
    const text = this.scene.add
      .text(x, y - 20, label, { ...bodyText(size, color, "700"), stroke: "#141b31", strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(120);
    this.scene.tweens.add({ targets: text, y: y - 90, alpha: 0, duration: 900, ease: "Quad.Out", onComplete: () => text.destroy() });
  }
}
