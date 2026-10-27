import { Difficulty, TeamId } from "@/config/game";
import { MAX_SHOT_SPEED } from "@/config/physics";

export interface AIBotState {
  uid: number;
  index: number;
  x: number;
  y: number;
}

export interface AIContext {
  team: TeamId;
  bots: AIBotState[];
  opponentBots: AIBotState[];
  ball: { x: number; y: number };
  ownGoal: { x: number; y: number };
  opponentGoal: { x: number; y: number };
  difficulty: Difficulty;
  /** Incrementing turn counter, used to alternate the support bot's role. */
  turnNumber: number;
  /** Injectable RNG (defaults to Math.random) so tests can be deterministic. */
  rng?: () => number;
}

export interface AIShot {
  botUid: number;
  vx: number;
  vy: number;
}

interface NoiseProfile {
  angleDeg: number;
  power: number;
}

const NOISE_BY_DIFFICULTY: Record<Difficulty, NoiseProfile> = {
  easy: { angleDeg: 26, power: 0.4 },
  normal: { angleDeg: 13, power: 0.2 },
  hard: { angleDeg: 5, power: 0.08 },
};

function vecLen(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = vecLen(x, y) || 1;
  return { x: x / len, y: y / len };
}

function rotate(x: number, y: number, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Rule-based AI, no predictive physics: each bot aims at a target point derived
 * from the current (static) ball/goal geometry, with difficulty-scaled random noise.
 */
export class AIController {
  static computeShots(ctx: AIContext): AIShot[] {
    const rng = ctx.rng ?? Math.random;
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const shots: AIShot[] = [];

    const sorted = [...ctx.bots].sort((a, b) => a.index - b.index);
    const defender = sorted[0];
    const attacker = sorted[1];
    const support = sorted[2];

    if (defender) {
      shots.push(this.aimAt(defender, this.defenderTarget(ctx), noise, rng));
    }
    if (attacker) {
      shots.push(this.aimAt(attacker, this.attackerTarget(ctx), noise, rng));
    }
    if (support) {
      const supportTarget =
        ctx.turnNumber % 2 === 0 ? this.attackerTarget(ctx, support) : this.harassTarget(ctx, support);
      shots.push(this.aimAt(support, supportTarget, noise, rng));
    }

    return shots;
  }

  /** Aim point just behind the ball, on the ball -> opponent-goal axis, so hitting it pushes it goalward. */
  private static attackerTarget(ctx: AIContext, bot?: AIBotState): { x: number; y: number } {
    const toGoal = normalize(ctx.opponentGoal.x - ctx.ball.x, ctx.opponentGoal.y - ctx.ball.y);
    const behind = 46; // bot radius + ball radius + margin, approx.
    let target = { x: ctx.ball.x - toGoal.x * behind, y: ctx.ball.y - toGoal.y * behind };
    if (bot) {
      // Offset the support bot sideways so it doesn't collide with the main attacker's line.
      const side = normalize(-toGoal.y, toGoal.x);
      const sign = bot.y >= ctx.ball.y ? 1 : -1;
      target = { x: target.x + side.x * 70 * sign, y: target.y + side.y * 70 * sign };
    }
    return target;
  }

  /** Positions the defender between the ball and its own goal, closer to the goal. */
  private static defenderTarget(ctx: AIContext): { x: number; y: number } {
    const t = 0.35;
    return {
      x: ctx.ownGoal.x + (ctx.ball.x - ctx.ownGoal.x) * t,
      y: ctx.ownGoal.y + (ctx.ball.y - ctx.ownGoal.y) * t,
    };
  }

  /** Aim towards the nearest opponent bot to the ball, to disrupt it. */
  private static harassTarget(ctx: AIContext, bot: AIBotState): { x: number; y: number } {
    if (ctx.opponentBots.length === 0) return ctx.ball;
    let nearest = ctx.opponentBots[0];
    let bestDist = Infinity;
    for (const ob of ctx.opponentBots) {
      const d = vecLen(ob.x - ctx.ball.x, ob.y - ctx.ball.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = ob;
      }
    }
    void bot;
    return { x: nearest.x, y: nearest.y };
  }

  private static aimAt(
    bot: AIBotState,
    target: { x: number; y: number },
    noise: NoiseProfile,
    rng: () => number,
  ): AIShot {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distance = vecLen(dx, dy);
    let dir = normalize(dx, dy);

    const angleNoise = (rng() * 2 - 1) * noise.angleDeg * (Math.PI / 180);
    dir = rotate(dir.x, dir.y, angleNoise);

    const basePower = Math.min(1, Math.max(0.3, distance / 260));
    const powerNoise = 1 + (rng() * 2 - 1) * noise.power;
    const power = Math.min(1, Math.max(0.15, basePower * powerNoise));

    return {
      botUid: bot.uid,
      vx: dir.x * power * MAX_SHOT_SPEED,
      vy: dir.y * power * MAX_SHOT_SPEED,
    };
  }
}
