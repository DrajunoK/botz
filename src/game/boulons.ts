import { ARENA, BOLT_RADIUS, MIRROR_X, PIT, mirrorX } from "@/config/boulons";

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

export interface Pit {
  x: number;
  y: number;
  r: number;
}

/** Whether a centre is far enough inside the pit's rim to fall in (`margin` px inside the rim). */
export const inPit = (pit: Pit, x: number, y: number, margin = 0): boolean => Math.hypot(x - pit.x, y - pit.y) <= pit.r - margin;

/** Where the i-th bolt of a pile lies inside a pit: a sunflower spiral, `radius` wide, `capacity` bolts. */
export function pileSpot(i: number, radius: number, capacity: number): { x: number; y: number } {
  const k = Math.min(i, capacity - 1);
  const a = k * 2.399963; // golden angle
  const d = radius * Math.sqrt((k + 0.5) / capacity);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

/**
 * Picks `pairs` mirrored pairs of spots for bolts on the left half and their twins on the right, clear
 * of everything in `avoid` (botz, bolts already on the floor) and of the deposit zones. `next` is the
 * seeded generator, so both devices drop the same bolts.
 */
export function pickBoltSpots(next: () => number, pairs: number, avoid: readonly Point[], gap = 62): Point[] {
  const out: Point[] = [];
  const clear = (p: Point) => [...avoid, ...out].every((a) => Math.hypot(a.x - p.x, a.y - p.y) >= gap);
  const xMin = PIT.red.x + PIT.red.r + 50;
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
