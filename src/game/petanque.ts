import { TeamId } from "@/config/game";
import { BOT_PHYSICS, MAX_SHOT_SPEED } from "@/config/physics";
import { SHOT_SPEED_SCALE } from "@/config/petanque";

export interface EndBot {
  uid: number;
  team: TeamId;
  x: number;
  y: number;
}

export interface RankedBot {
  bot: EndBot;
  /** Edge-to-edge distance to the jack. */
  distance: number;
}

export interface EndResult {
  /** Team that scores the end, or null when the best two botz are exactly level. */
  winner: TeamId | null;
  points: number;
  /** Every bot, closest to the jack first. */
  ranked: RankedBot[];
  /** Botz that count for a point (the winner's botz closer than the opponent's best). */
  scoringUids: number[];
}

/**
 * Scores an end: the team with the closest bot scores one point per bot closer to the jack than the
 * opponent's best bot. Distances are measured edge to edge (centre distance minus both radii).
 */
export function scoreEnd(jack: { x: number; y: number }, bots: readonly EndBot[], botRadius: number, jackRadius: number): EndResult {
  const ranked = bots
    .map((bot) => ({ bot, distance: Math.hypot(bot.x - jack.x, bot.y - jack.y) - botRadius - jackRadius }))
    .sort((a, b) => a.distance - b.distance);

  const none: EndResult = { winner: null, points: 0, ranked, scoringUids: [] };
  if (ranked.length === 0) return none;

  const best = ranked[0];
  const opponentBest = ranked.find((r) => r.bot.team !== best.bot.team);
  if (opponentBest && Math.abs(opponentBest.distance - best.distance) < 1e-6) return none;

  const limit = opponentBest ? opponentBest.distance : Infinity;
  const scoring = ranked.filter((r) => r.bot.team === best.bot.team && r.distance < limit);
  return { winner: best.bot.team, points: scoring.length, ranked, scoringUids: scoring.map((r) => r.bot.uid) };
}

/** Distance a thrown bot glides before air friction stops it, for an aimed speed (before the Pétanque scale). */
export function estimateTravelDistance(speed: number): number {
  const f = BOT_PHYSICS.frictionAir;
  return (speed * SHOT_SPEED_SCALE * (1 - f)) / f;
}

/** Inverse of `estimateTravelDistance`, capped at the strongest possible shot. */
export function speedForDistance(distance: number): number {
  const f = BOT_PHYSICS.frictionAir;
  return Math.min(MAX_SHOT_SPEED, (distance * f) / ((1 - f) * SHOT_SPEED_SCALE));
}
