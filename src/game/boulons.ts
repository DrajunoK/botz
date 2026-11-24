import { ARENA, BOLT_RADIUS, MIRROR_X, mirrorX } from "@/config/boulons";

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/**
 * Picks `pairs` mirrored pairs of spots for bolts on the left half and their twins on the right, clear
 * of everything in `avoid` (botz, bolts already on the floor) and of the deposit zones. `next` is the
 * seeded generator, so both devices drop the same bolts.
 */
export function pickBoltSpots(next: () => number, pairs: number, avoid: readonly Point[], gap = 62): Point[] {
  const out: Point[] = [];
  const clear = (p: Point) => [...avoid, ...out].every((a) => Math.hypot(a.x - p.x, a.y - p.y) >= gap);
  const xMin = ARENA.left + 230;
  const xMax = MIRROR_X - BOLT_RADIUS - 40; // left of the centre line, so twins never touch
  for (let i = 0; i < pairs; i++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const p = { x: xMin + next() * (xMax - xMin), y: ARENA.top + 50 + next() * (ARENA.bottom - ARENA.top - 100) };
      const twin = { x: mirrorX(p.x), y: p.y };
      if (!clear(p) || !clear(twin)) continue;
      out.push(p, twin);
      break;
    }
  }
  return out;
}
