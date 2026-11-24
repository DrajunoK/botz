import Phaser from "phaser";
import { BOTZ_PER_TEAM, GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import {
  BUMPERS_PER_FRAME,
  BUMPER_OFFSET_MAX,
  BUMPER_OFFSET_MIN,
  BUMPER_RADIUS,
  BUMPER_X_MAX,
  BUMPER_X_MIN,
  FRAMES,
  FRAME_PAUSE_MS,
  GOLD_PIN_VALUE,
  GUTTER_EDGE,
  GUTTER_OFFSET,
  HEAD_PIN_X,
  LANE_CENTER,
  PIN_COUNT,
  SHOT_SPEED_SCALE,
  START_X,
  WALL_RESTITUTION,
} from "@/config/bowling";
import { BOT_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { BowlingField } from "@/game/field/BowlingField";
import { PinRack } from "@/game/entities/PinRack";
import type { Bot } from "@/game/entities/Bot";
import { Bumper, bowlingWinner, inGutter, pathClears, pickBumpers, pinPoints, rackSpots } from "@/game/bowling";
import { Body } from "@/game/util/matter";
import { bodyText, titleText } from "@/ui/ui";

const TEAMS: TeamId[] = ["red", "yellow"];

/**
 * Bowling with a twist: each team has its own lane and ten pins, and gets ONE throw per frame, six
 * frames. Every frame, round bumpers stand in the lanes (the same ones on both) and one pin is golden
 * (worth 3). The pins are heavy, so a strike takes a well-placed shot. More pins wins; a tie plays one
 * more frame.
 */
export class BowlingMode implements GameMode {
  readonly id = "bowling";
  /** Unused: the game is decided by `checkWinner` after the last frame. */
  readonly goalsToWin = 999;
  readonly hud = { alarmGauge: false, standings: false };
  readonly shotSpeedScale = SHOT_SPEED_SCALE;

  private scene!: Phaser.Scene;
  private racks!: Record<TeamId, PinRack>;
  private layer!: Phaser.GameObjects.Graphics;
  private points: Record<TeamId, number> = { red: 0, yellow: 0 };
  private frame = 1;
  private framesPlayed = 0;
  private started = false;
  private goldIndex = -1;
  private bumpers: Bumper[] = [];
  private bumperBodies: Record<TeamId, MatterJS.BodyType[]> = { red: [], yellow: [] };
  private bumperActive = false;
  private banner: Phaser.GameObjects.GameObject[] = [];

  buildField(scene: Phaser.Scene): void {
    this.scene = scene;
    this.points = { red: 0, yellow: 0 };
    this.frame = 1;
    this.framesPlayed = 0;
    this.started = false;
    this.goldIndex = -1;
    this.bumpers = [];
    this.bumperActive = false;
    this.banner = [];
    new BowlingField(scene);
    this.racks = {
      red: new PinRack(scene, rackSpots(HEAD_PIN_X, LANE_CENTER.red)),
      yellow: new PinRack(scene, rackSpots(HEAD_PIN_X, LANE_CENTER.yellow)),
    };
    for (const team of TEAMS) {
      this.bumperBodies[team] = Array.from({ length: BUMPERS_PER_FRAME }, () => {
        const body = scene.matter.add.circle(-500, -500, BUMPER_RADIUS, { isStatic: true, restitution: WALL_RESTITUTION + 0.2, friction: 0.02, label: "bumper" }) as MatterJS.BodyType;
        scene.matter.world.remove(body);
        return body;
      });
    }
    this.layer = scene.add.graphics().setDepth(-4);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return Array.from({ length: BOTZ_PER_TEAM }, () => ({ x: START_X, y: LANE_CENTER[team] }));
  }

  /** One botz per frame, rotating so the damage is shared. */
  canAim(bot: Bot): boolean {
    return !bot.eliminated && bot.index === (this.frame - 1) % BOTZ_PER_TEAM;
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
      if (this.canAimIndex(b) && b.eliminated) b.revive(ctx.scene, START_X, LANE_CENTER[b.team], false);
    }
    this.setUpFrame(ctx);
  }

  private canAimIndex(b: Bot): boolean {
    return b.index === (this.frame - 1) % BOTZ_PER_TEAM;
  }

  /** Draws this frame's golden pin and bumpers (once per frame: the aim phase can be entered again after a reconnection). */
  private setUpFrame(ctx: ModeContext): void {
    if (this.bumperActive) return;
    this.bumperActive = true;
    const next = () => ctx.rng.next();
    this.goldIndex = Math.floor(next() * PIN_COUNT);
    this.bumpers = pickBumpers(next, BUMPERS_PER_FRAME, BUMPER_X_MIN, BUMPER_X_MAX, BUMPER_OFFSET_MIN, BUMPER_OFFSET_MAX, BUMPER_RADIUS * 4);
    for (const team of TEAMS) {
      this.bumpers.forEach((b, i) => {
        const body = this.bumperBodies[team][i];
        this.scene.matter.world.add(body);
        Body.setPosition(body, { x: b.x, y: LANE_CENTER[team] + b.dy });
      });
    }
  }

  notice(): { text: string } {
    const extra = this.frame > FRAMES ? "Manche bonus" : `Manche ${this.frame}/${FRAMES}`;
    return { text: `${extra} · quille dorée = ${GOLD_PIN_VALUE}` };
  }

  /** A ball that drops into a gutter keeps rolling straight down it: it can never reach the pins. */
  afterStep(ctx: ModeContext): void {
    for (const b of ctx.bots) {
      if (b.eliminated) continue;
      const cy = LANE_CENTER[b.team];
      const { x, y } = b.body.position;
      if (!inGutter(y, cy, GUTTER_EDGE)) continue;
      Body.setPosition(b.body, { x, y: cy + Math.sign(y - cy) * GUTTER_OFFSET });
      Body.setVelocity(b.body, { x: b.body.velocity.x, y: 0 });
    }
  }

  /** The throw is over: count what fell (the golden pin counts more), show it, and hold the game a moment. */
  onSettled(): { pauseMs: number } {
    for (const team of TEAMS) {
      const fallen = this.racks[team].knocked();
      const gained = pinPoints(fallen, this.goldIndex, GOLD_PIN_VALUE);
      this.points[team] += gained;
      this.showCount(team, fallen.length, gained, fallen.includes(this.goldIndex));
    }
    this.framesPlayed += 1;
    return { pauseMs: FRAME_PAUSE_MS };
  }

  /** After the pause: new rack, balls back, bumpers away. */
  onResume(ctx: ModeContext): void {
    this.clearBanner();
    for (const team of TEAMS) {
      this.racks[team].reset();
      for (const body of this.bumperBodies[team]) this.scene.matter.world.remove(body);
    }
    this.bumperActive = false;
    this.bumpers = [];
    for (const b of ctx.bots) b.bench(ctx.scene);
    ctx.debris.clear();
    this.frame += 1;
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    const winner = bowlingWinner(this.points, this.framesPlayed, FRAMES);
    return winner ? { winner, score: this.score() } : null;
  }

  extraSpeeds(): number[] {
    return TEAMS.flatMap((t) => this.racks[t].speeds());
  }

  syncVisuals(): void {
    const g = this.layer;
    g.clear();
    for (const t of TEAMS) {
      this.racks[t].draw(g, this.goldIndex);
      if (this.bumperActive) for (const b of this.bumpers) this.drawBumper(g, b.x, LANE_CENTER[t] + b.dy);
    }
  }

  private drawBumper(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const r = BUMPER_RADIUS;
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x + 4, y + 8, r * 2.2, r * 1.8);
    g.fillStyle(0xd63a33, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0xf8f4ea, 1);
    g.fillCircle(x, y, r * 0.72);
    g.fillStyle(0xd63a33, 1);
    g.fillCircle(x, y, r * 0.44);
    g.fillStyle(0xf8f4ea, 1);
    g.fillCircle(x, y, r * 0.18);
    g.lineStyle(3, 0x2b2233, 1);
    g.strokeCircle(x, y, r);
  }

  /** The AI picks a pin it can reach without hitting a bumper, and throws hard at it. */
  aiShots(ctx: ModeAIContext) {
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const standing = this.racks[ctx.team].standingSpots();
    const cy = LANE_CENTER[ctx.team];
    const posts = this.bumpers.map((b) => ({ x: b.x, y: cy + b.dy }));
    return ctx.bots.map((bot) => {
      const from = { x: bot.x, y: bot.y };
      const byFront = [...standing].sort((a, b) => a.x - b.x || Math.abs(a.y - cy) - Math.abs(b.y - cy));
      const clear = byFront.find((p) => posts.every((post) => pathClears(from, p, post, BUMPER_RADIUS + BOT_RADIUS + 4)));
      const front = clear ?? byFront[0] ?? { x: HEAD_PIN_X, y: cy };
      const target = { x: front.x, y: front.y + (front.y > cy ? -6 : 6) };
      const angle = (ctx.rng() * 2 - 1) * noise.angleDeg * (Math.PI / 180);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const speed = Math.min(MAX_SHOT_SPEED, MAX_SHOT_SPEED * (0.97 - ctx.rng() * noise.power * 0.1));
      return { botUid: bot.uid, vx: ((dx / len) * c - (dy / len) * s) * speed, vy: ((dx / len) * s + (dy / len) * c) * speed };
    });
  }

  // ───────────────────────────── banners ─────────────────────────────

  private showCount(team: TeamId, fallen: number, gained: number, gold: boolean): void {
    const label = fallen >= PIN_COUNT ? "STRIKE !" : fallen === 0 ? "RATÉ…" : `${fallen} quille${fallen > 1 ? "s" : ""}${gold ? " · DORÉE !" : ""}`;
    const y = LANE_CENTER[team] - 6;
    const text = this.scene.add
      .text(GAME_WIDTH / 2 + 120, y, label, titleText(fallen >= PIN_COUNT ? 54 : 40, `#${TEAM_COLORS[team].toString(16).padStart(6, "0")}`))
      .setOrigin(0.5)
      .setDepth(120)
      .setStroke("#141b31", 8);
    this.scene.tweens.add({ targets: text, y: y - 24, duration: 600, ease: "Back.Out" });
    const total = this.scene.add
      .text(GAME_WIDTH / 2 + 120, y + 40, `+${gained} · total ${this.points[team]}`, bodyText(26, "#ffffff", "700"))
      .setOrigin(0.5)
      .setDepth(120)
      .setStroke("#141b31", 6);
    this.banner.push(text, total);
  }

  private clearBanner(): void {
    for (const o of this.banner) o.destroy();
    this.banner = [];
  }
}
