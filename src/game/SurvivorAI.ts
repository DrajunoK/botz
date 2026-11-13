import { Difficulty } from "@/config/game";
import { BOT_PHYSICS, BOT_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { AIBotState, AIShot, NOISE_BY_DIFFICULTY } from "@/game/AIController";
import { Disc } from "@/game/field/survivorGeometry";

export interface SurvivorAIContext {
  /** The AI's own botz still on the catwalk. */
  bots: AIBotState[];
  /** The opponent's botz still on the catwalk. */
  opponentBots: AIBotState[];
  platform: Disc;
  difficulty: Difficulty;
  rng: () => number;
}

/** Total distance a bot travels from its launch speed (px/step) before air friction stops it. */
const TRAVEL_PER_SPEED = (1 - BOT_PHYSICS.frictionAir) / BOT_PHYSICS.frictionAir;
/** A bot never aims to stop further out than this share of the radius. */
const SAFE_STOP = 0.85;
/** Bots further out than this share of the radius pull back to the centre instead of attacking. */
const DANGER_ZONE = 0.78;

/**
 * Rule-based AI for Survivant: every bot aims at the enemy closest to the edge and hits it from
 * the centre side, so the push sends it outwards. Power is capped so the AI's own bot does not
 * slide off the catwalk after the hit; a bot already near the edge retreats towards the centre.
 */
export class SurvivorAI {
  static computeShots(ctx: SurvivorAIContext): AIShot[] {
    const { platform } = ctx;
    const noise = NOISE_BY_DIFFICULTY[ctx.difficulty];
    const distFromCentre = (p: { x: number; y: number }) => Math.hypot(p.x - platform.x, p.y - platform.y);

    return ctx.bots.map((bot) => {
      const retreating = distFromCentre(bot) > platform.radius * DANGER_ZONE || ctx.opponentBots.length === 0;
      let target: { x: number; y: number };
      let reach: number;

      if (retreating) {
        target = { x: platform.x, y: platform.y };
        reach = Math.max(0, distFromCentre(bot) - platform.radius * 0.3);
      } else {
        // The enemy nearest the edge is the easiest to push off; ties go to the closest to this bot.
        const enemy = ctx.opponentBots.reduce((best, e) =>
          distFromCentre(e) - Math.hypot(e.x - bot.x, e.y - bot.y) * 0.25 >
          distFromCentre(best) - Math.hypot(best.x - bot.x, best.y - bot.y) * 0.25
            ? e
            : best,
        );
        const out = unit(enemy.x - platform.x, enemy.y - platform.y);
        // Aim a little behind the enemy, on the centre -> enemy line, to drive it outwards.
        target = { x: enemy.x + out.x * BOT_RADIUS * 0.6, y: enemy.y + out.y * BOT_RADIUS * 0.6 };
        reach = Math.hypot(target.x - bot.x, target.y - bot.y) + BOT_RADIUS;
      }

      const dir = rotate(unit(target.x - bot.x, target.y - bot.y), (ctx.rng() * 2 - 1) * noise.angleDeg * (Math.PI / 180));
      let speed = Math.min(MAX_SHOT_SPEED, Math.max(4, reach / TRAVEL_PER_SPEED));
      speed *= 1 + (ctx.rng() * 2 - 1) * noise.power;

      // Never aim to stop beyond the safe ring (the opponent absorbs part of the speed, but don't count on it).
      if (!retreating) {
        const stop = { x: bot.x + dir.x * speed * TRAVEL_PER_SPEED, y: bot.y + dir.y * speed * TRAVEL_PER_SPEED };
        const outside = distFromCentre(stop) - platform.radius * SAFE_STOP;
        if (outside > 0) speed = Math.max(4, speed - outside / TRAVEL_PER_SPEED);
      }
      speed = Math.min(MAX_SHOT_SPEED, speed);

      return { botUid: bot.uid, vx: dir.x * speed, vy: dir.y * speed };
    });
  }
}

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function rotate(v: { x: number; y: number }, radians: number): { x: number; y: number } {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
