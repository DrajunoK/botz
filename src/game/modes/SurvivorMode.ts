import Phaser from "phaser";
import { BOTZ_PER_TEAM, TeamId } from "@/config/game";
import { FALL_MS, MIN_RADIUS_RATIO, PLATFORM_RADIUS } from "@/config/survivor";
import { GameMode, ModeAIContext, ModeContext } from "./GameMode";
import { LavaPlatform } from "@/game/field/LavaPlatform";
import { isOffPlatform, shrinksAtTurn, shrunkRadius, spawnPositions, warnsAtTurn } from "@/game/field/survivorGeometry";
import { SurvivorAI } from "@/game/SurvivorAI";
import { SFX } from "@/game/Audio";
import { playLavaSplash } from "@/ui/Overlays";

/**
 * Survivant: botz push each other off a round catwalk into the lava. A bot is out as soon as its
 * centre leaves the catwalk; the catwalk shrinks every third turn; last team standing wins.
 */
export class SurvivorMode implements GameMode {
  readonly id = "survivor";
  /** Unused: the game is decided by `checkWinner`, not by a running score. */
  readonly goalsToWin = BOTZ_PER_TEAM;
  readonly hud = { alarmGauge: false, standings: true };

  private platform!: LavaPlatform;
  private suddenDeath = false;

  buildField(scene: Phaser.Scene): void {
    this.suddenDeath = false;
    this.platform = new LavaPlatform(scene);
  }

  botSpawns(team: TeamId): { x: number; y: number }[] {
    return spawnPositions(team, BOTZ_PER_TEAM, this.platform.disc);
  }

  onAimPhase(ctx: ModeContext, turnNumber: number): void {
    if (!shrinksAtTurn(turnNumber)) return;
    const radius = shrunkRadius(this.platform.disc.radius, PLATFORM_RADIUS);
    if (radius >= this.platform.disc.radius) return;
    this.platform.setRadius(radius);
    // Whoever stands beyond the new edge goes down with it.
    this.dropBotsOutside(ctx, { ...this.platform.disc, radius });
  }

  afterStep(ctx: ModeContext): void {
    const disc = this.platform.disc;
    this.dropBotsOutside(ctx, disc);
    ctx.debris.dropWhere((x, y) => isOffPlatform(x, y, disc));
  }

  notice(turnNumber: number): { text: string; warning: boolean } | null {
    if (this.suddenDeath) return { text: "Mort subite", warning: true };
    const { radius } = this.platform.disc;
    const canShrink = radius > PLATFORM_RADIUS * MIN_RADIUS_RATIO + 0.5;
    return canShrink && warnsAtTurn(turnNumber) ? { text: "Rétrécit dans 1 tour", warning: true } : null;
  }

  aiShots(ctx: ModeAIContext) {
    return SurvivorAI.computeShots({
      bots: ctx.bots,
      opponentBots: ctx.opponentBots,
      platform: this.platform.disc,
      difficulty: ctx.difficulty,
      rng: ctx.rng,
    });
  }

  checkWinner(ctx: ModeContext): { winner: TeamId; score: Record<TeamId, number> } | null {
    const alive: Record<TeamId, number> = { red: 0, yellow: 0 };
    for (const b of ctx.bots) if (!b.eliminated) alive[b.team] += 1;

    if (alive.red === 0 && alive.yellow === 0) {
      this.startSuddenDeath(ctx);
      return null;
    }
    if (alive.red === 0 || alive.yellow === 0) {
      const winner: TeamId = alive.red === 0 ? "yellow" : "red";
      // The ranking shows botz left standing; the loser has none, so the winner's count is always higher.
      return { winner, score: alive };
    }
    return null;
  }

  /** Both teams lost their last bot in the same turn: one fresh bot each, on the smallest catwalk. */
  private startSuddenDeath(ctx: ModeContext): void {
    this.suddenDeath = true;
    const small = PLATFORM_RADIUS * MIN_RADIUS_RATIO;
    this.platform.setRadius(small, false);
    const disc = this.platform.disc;
    for (const team of ["red", "yellow"] as TeamId[]) {
      const [spawn] = spawnPositions(team, 1, disc);
      ctx.bots.find((b) => b.team === team && b.index === 0)?.revive(ctx.scene, spawn.x, spawn.y);
    }
  }

  private dropBotsOutside(ctx: ModeContext, disc: { x: number; y: number; radius: number }): void {
    for (const bot of ctx.bots) {
      if (bot.eliminated) continue;
      const { x, y } = bot.position;
      if (!isOffPlatform(x, y, disc)) continue;
      bot.eliminate(ctx.scene, FALL_MS);
      playLavaSplash(ctx.scene, x, y);
      SFX.playSplash();
    }
  }
}
