import Phaser from "phaser";
import { BOTZ_PER_TEAM, GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import {
  FRAMES,
  FRAME_PAUSE_MS,
  GUTTER_EDGE,
  GUTTER_OFFSET,
  HEAD_PIN_X,
  LANE_CENTER,
  PIN_COUNT,
  SHOT_SPEED_SCALE,
  START_X,
  THROWS_PER_FRAME,
} from "@/config/bowling";
import { MAX_SHOT_SPEED } from "@/config/physics";
import { NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { BowlingField } from "@/game/field/BowlingField";
import { PinRack } from "@/game/entities/PinRack";
import type { Bot } from "@/game/entities/Bot";
import { bowlingWinner, inGutter, rackSpots } from "@/game/bowling";
import { Body } from "@/game/util/matter";
import { bodyText, titleText } from "@/ui/ui";

const TEAMS: TeamId[] = ["red", "yellow"];
const THROW_PAUSE_MS = 1500;

/**
 * Bowling: each team has its own lane and its own ten pins. A frame is two throws (one botz each,
 * both teams at the same time); the pins that fall count. A strike sets up a fresh rack for the
 * second throw. After 5 frames the team with more pins wins; a tie plays one more frame.
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
  private pins: Record<TeamId, number> = { red: 0, yellow: 0 };
  private frame = 1;
  private framesPlayed = 0;
  /** 0-based index of the throw inside the frame (also the index of the bot that throws). */
  private throwIndex = 0;
  private started = false;
  private pendingKnocked: Record<TeamId, number[]> = { red: [], yellow: [] };
  private pendingFrameEnd = false;
  private banner: Phaser.GameObjects.GameObject[] = [];

  buildField(scene: Phaser.Scene): void {
    this.scene = scene;
    this.pins = { red: 0, yellow: 0 };
    this.frame = 1;
    this.framesPlayed = 0;
    this.throwIndex = 0;
    this.started = false;
    this.pendingKnocked = { red: [], yellow: [] };
    this.pendingFrameEnd = false;
    this.banner = [];
    new BowlingField(scene);
    this.racks = {
      red: new PinRack(scene, rackSpots(HEAD_PIN_X, LANE_CENTER.red)),
      yellow: new PinRack(scene, rackSpots(HEAD_PIN_X, LANE_CENTER.yellow)),
    };
    this.layer = scene.add.graphics().setDepth(-4);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return Array.from({ length: BOTZ_PER_TEAM }, () => ({ x: START_X, y: LANE_CENTER[team] }));
  }

  canAim(bot: Bot): boolean {
    return !bot.eliminated && bot.index === this.throwIndex;
  }

  score(): Record<TeamId, number> {
    return { ...this.pins };
  }

  onAimPhase(ctx: ModeContext): void {
    if (!this.started) {
      this.started = true;
      for (const b of ctx.bots) b.bench(ctx.scene);
    }
    for (const b of ctx.bots) {
      if (b.index === this.throwIndex && b.eliminated) b.revive(ctx.scene, START_X, LANE_CENTER[b.team], false);
    }
  }

  notice(): { text: string } {
    const extra = this.frame > FRAMES ? "Manche bonus" : `Manche ${this.frame}/${FRAMES}`;
    return { text: `${extra} · Lancer ${Math.min(this.throwIndex + 1, THROWS_PER_FRAME)}/${THROWS_PER_FRAME}` };
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

  /** The throw is over: count what fell, show it, and hold the game a moment. */
  onSettled(): { pauseMs: number } {
    const lastThrow = this.throwIndex + 1 >= THROWS_PER_FRAME;
    for (const team of TEAMS) {
      const fallen = this.racks[team].knocked();
      this.pendingKnocked[team] = fallen;
      this.pins[team] += fallen.length;
      this.showCount(team, fallen.length, lastThrow);
    }
    this.pendingFrameEnd = lastThrow;
    if (lastThrow) this.framesPlayed += 1;
    return { pauseMs: lastThrow ? FRAME_PAUSE_MS : THROW_PAUSE_MS };
  }

  /** After the pause: sweep the fallen pins, send the balls back, set up the next throw or frame. */
  onResume(ctx: ModeContext): void {
    this.clearBanner();
    for (const team of TEAMS) {
      const rack = this.racks[team];
      const strike = this.pendingKnocked[team].length >= PIN_COUNT;
      if (this.pendingFrameEnd || strike) rack.reset();
      else rack.clearKnocked(this.pendingKnocked[team]);
    }
    for (const b of ctx.bots) b.bench(ctx.scene);
    ctx.debris.clear();
    if (this.pendingFrameEnd) {
      this.throwIndex = 0;
      this.frame += 1;
    } else {
      this.throwIndex += 1;
    }
  }

  checkWinner(): { winner: TeamId; score: Record<TeamId, number> } | null {
    if (!this.pendingFrameEnd) return null;
    const winner = bowlingWinner(this.pins, this.framesPlayed, FRAMES);
    return winner ? { winner, score: this.score() } : null;
  }

  extraSpeeds(): number[] {
    return TEAMS.flatMap((t) => this.racks[t].speeds());
  }

  syncVisuals(): void {
    this.layer.clear();
    for (const t of TEAMS) this.racks[t].draw(this.layer);
  }

  /** The AI aims for the front pin it can still see, a little off-centre, hard. */
  aiShots(ctx: ModeAIContext) {
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const standing = this.racks[ctx.team].standingSpots();
    const cy = LANE_CENTER[ctx.team];
    return ctx.bots.map((bot) => {
      const front = [...standing].sort((a, b) => a.x - b.x || Math.abs(a.y - cy) - Math.abs(b.y - cy))[0] ?? { x: HEAD_PIN_X, y: cy };
      const target = { x: front.x, y: front.y + (front.y > cy ? -6 : 6) };
      const angle = (ctx.rng() * 2 - 1) * noise.angleDeg * (Math.PI / 180);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const speed = Math.min(MAX_SHOT_SPEED, MAX_SHOT_SPEED * (0.88 + (ctx.rng() * 2 - 1) * noise.power * 0.12));
      return { botUid: bot.uid, vx: ((dx / len) * c - (dy / len) * s) * speed, vy: ((dx / len) * s + (dy / len) * c) * speed };
    });
  }

  // ───────────────────────────── banners ─────────────────────────────

  private showCount(team: TeamId, fallen: number, lastThrow: boolean): void {
    const label = fallen >= PIN_COUNT ? "STRIKE !" : fallen === 0 ? "RATÉ…" : `${fallen} quille${fallen > 1 ? "s" : ""}`;
    const y = LANE_CENTER[team] - 6;
    const text = this.scene.add
      .text(GAME_WIDTH / 2 + 120, y, label, titleText(fallen >= PIN_COUNT ? 54 : 42, `#${TEAM_COLORS[team].toString(16).padStart(6, "0")}`))
      .setOrigin(0.5)
      .setDepth(120)
      .setStroke("#141b31", 8);
    this.scene.tweens.add({ targets: text, y: y - 24, duration: 600, ease: "Back.Out" });
    this.banner.push(text);
    if (lastThrow) {
      const total = this.scene.add
        .text(GAME_WIDTH / 2 + 120, y + 40, `Total ${this.pins[team]}`, bodyText(26, "#ffffff", "700"))
        .setOrigin(0.5)
        .setDepth(120)
        .setStroke("#141b31", 6);
      this.banner.push(total);
    }
  }

  private clearBanner(): void {
    for (const o of this.banner) o.destroy();
    this.banner = [];
  }
}
