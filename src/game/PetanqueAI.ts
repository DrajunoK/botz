import { Difficulty } from "@/config/game";
import { BOT_RADIUS, CLOCK_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { AIBotState, AIShot, NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { speedForDistance } from "@/game/petanque";

export interface PetanqueAIContext {
  /** The bot to throw this turn (one per team). */
  bots: AIBotState[];
  /** The AI's botz already on the court. */
  ownBots: AIBotState[];
  /** The opponent's botz already on the court. */
  opponentBots: AIBotState[];
  jack: { x: number; y: number };
  difficulty: Difficulty;
  rng: () => number;
}

/** An opponent bot this close to the jack (edge to edge) is worth shooting at rather than out-pointing. */
const SHOOT_WHEN_WITHIN = 90;
/** Where a pointing bot aims to stop, relative to touching the jack. */
const STOP_MARGIN = 8;

const edgeDistance = (b: { x: number; y: number }, jack: { x: number; y: number }) =>
  Math.hypot(b.x - jack.x, b.y - jack.y) - BOT_RADIUS - CLOCK_RADIUS;

/**
 * Rule-based Pétanque AI. If the opponent holds the closest bot and it sits right next to the jack,
 * the bot shoots it at full power; otherwise it points: it aims to stop just short of the jack.
 */
export class PetanqueAI {
  static computeShots(ctx: PetanqueAIContext): AIShot[] {
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const best = (bots: AIBotState[]) => bots.reduce((m, b) => Math.min(m, edgeDistance(b, ctx.jack)), Infinity);
    const ownBest = best(ctx.ownBots);
    const oppBest = best(ctx.opponentBots);

    return ctx.bots.map((bot) => {
      let target = ctx.jack;
      let speed: number;

      const threat = ctx.opponentBots.find((o) => edgeDistance(o, ctx.jack) === oppBest);
      if (threat && oppBest < ownBest && oppBest <= SHOOT_WHEN_WITHIN) {
        target = threat;
        speed = MAX_SHOT_SPEED * 0.95;
      } else {
        const reach = Math.max(0, Math.hypot(ctx.jack.x - bot.x, ctx.jack.y - bot.y) - BOT_RADIUS - CLOCK_RADIUS - STOP_MARGIN);
        speed = speedForDistance(reach);
      }

      const angle = (ctx.rng() * 2 - 1) * noise.angleDeg * (Math.PI / 180);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const ux = (dx / len) * c - (dy / len) * s;
      const uy = (dx / len) * s + (dy / len) * c;
      speed = Math.min(MAX_SHOT_SPEED, Math.max(3, speed * (1 + (ctx.rng() * 2 - 1) * noise.power * 0.5)));

      return { botUid: bot.uid, vx: ux * speed, vy: uy * speed };
    });
  }
}
