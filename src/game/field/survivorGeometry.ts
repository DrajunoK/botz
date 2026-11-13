import { TeamId } from "@/config/game";
import { MIN_RADIUS_RATIO, SHRINK_EVERY_TURNS, SHRINK_FACTOR } from "@/config/survivor";

export interface Disc {
  x: number;
  y: number;
  radius: number;
}

/** A bot is out as soon as its centre leaves the catwalk. */
export function isOffPlatform(x: number, y: number, disc: Disc): boolean {
  return Math.hypot(x - disc.x, y - disc.y) > disc.radius;
}

/** Radius after one shrink, never below `MIN_RADIUS_RATIO` of the initial radius. */
export function shrunkRadius(radius: number, initialRadius: number): number {
  return Math.max(radius * SHRINK_FACTOR, initialRadius * MIN_RADIUS_RATIO);
}

/** True when the catwalk shrinks as aim phase `turn` (1-based) begins: turns 4, 7, 10... */
export function shrinksAtTurn(turn: number): boolean {
  return turn > 1 && (turn - 1) % SHRINK_EVERY_TURNS === 0;
}

/** True during the turn right before a shrink (turns 3, 6, 9...): the HUD warns the players. */
export function warnsAtTurn(turn: number): boolean {
  return turn % SHRINK_EVERY_TURNS === 0;
}

/**
 * Starting formation: each team on its own side (red left, yellow right), fanned out on an arc
 * at 55 % of the radius so nobody starts near the edge.
 */
export function spawnPositions(team: TeamId, count: number, disc: Disc): { x: number; y: number }[] {
  const facing = team === "red" ? Math.PI : 0;
  const spread = 0.62;
  const ring = disc.radius * 0.55;
  return Array.from({ length: count }, (_, i) => {
    const angle = facing + (count === 1 ? 0 : (i - (count - 1) / 2) * spread);
    return { x: disc.x + Math.cos(angle) * ring, y: disc.y + Math.sin(angle) * ring };
  });
}
