import { BOT_RADIUS } from "@/config/physics";
import { EndBot, EndResult, scoreEnd } from "@/game/petanque";

/**
 * Scores an end of curling: only the botz whose centre sits inside the house count, then the same
 * rule as Pétanque applies (the closest bot scores, plus one point per teammate closer than the
 * opponent's best). Several points can be scored in one end.
 */
export function scoreCurlingEnd(center: { x: number; y: number }, houseRadius: number, bots: readonly EndBot[]): EndResult {
  const inHouse = bots.filter((b) => Math.hypot(b.x - center.x, b.y - center.y) <= houseRadius);
  return scoreEnd(center, inHouse, BOT_RADIUS, 0);
}
