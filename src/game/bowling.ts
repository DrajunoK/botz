import { PIN_COUNT, PIN_SPACING, KNOCKED_DISTANCE } from "@/config/bowling";

export interface Spot {
  x: number;
  y: number;
}

/** The ten spots of a rack: the head pin points at the bowler, rows of 1, 2, 3 and 4 pins behind it. */
export function rackSpots(headX: number, centerY: number): Spot[] {
  const spots: Spot[] = [];
  const rowGap = PIN_SPACING * 0.9;
  for (let col = 0; col < 4; col++) {
    for (let j = 0; j <= col; j++) {
      spots.push({ x: headX + col * rowGap, y: centerY + (j - col / 2) * PIN_SPACING });
    }
  }
  return spots.slice(0, PIN_COUNT);
}

/** Indexes of the pins that fell: a pin knocked off its spot, or no longer in play. */
export function knockedIndexes(spots: readonly Spot[], positions: readonly (Spot | null)[]): number[] {
  const out: number[] = [];
  spots.forEach((s, i) => {
    const p = positions[i];
    if (!p || Math.hypot(p.x - s.x, p.y - s.y) > KNOCKED_DISTANCE) out.push(i);
  });
  return out;
}

/** Whether a ball with its centre at `y` is in a gutter of the lane centred on `centerY`. */
export const inGutter = (y: number, centerY: number, edge: number): boolean => Math.abs(y - centerY) > edge;

/** Final standing after the scheduled frames: the higher total wins; a tie asks for one more frame. */
export function bowlingWinner(pins: { red: number; yellow: number }, framesPlayed: number, frames: number): "red" | "yellow" | null {
  if (framesPlayed < frames || pins.red === pins.yellow) return null;
  return pins.red > pins.yellow ? "red" : "yellow";
}

export interface Bumper {
  x: number;
  /** Offset from the lane's centre line (the same for both lanes). */
  dy: number;
}

/** Picks the bumpers of a frame: spread along the lane, never both on the same line. `next` is the seeded generator. */
export function pickBumpers(next: () => number, count: number, xMin: number, xMax: number, dyMin: number, dyMax: number, minGap: number): Bumper[] {
  const out: Bumper[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const b = { x: xMin + next() * (xMax - xMin), dy: (next() < 0.5 ? -1 : 1) * (dyMin + next() * (dyMax - dyMin)) };
      if (out.every((o) => Math.hypot(o.x - b.x, o.dy - b.dy) >= minGap)) {
        out.push(b);
        break;
      }
    }
  }
  return out;
}

/** Whether the straight path of a ball from `from` to `to` clears a round post. */
export function pathClears(from: Spot, to: Spot, post: Spot, clearance: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((post.x - from.x) * dx + (post.y - from.y) * dy) / len2));
  return Math.hypot(from.x + dx * t - post.x, from.y + dy * t - post.y) >= clearance;
}

/** Points for the pins that fell: one each, the golden one worth `goldValue`. */
export const pinPoints = (fallen: readonly number[], goldIndex: number, goldValue: number): number =>
  fallen.reduce((sum, i) => sum + (i === goldIndex ? goldValue : 1), 0);

export interface Scatter {
  x: number;
  /** Offset from the lane's centre line (the same pattern is used on both lanes). */
  dy: number;
}

/**
 * Ten pins scattered over the pin deck instead of a neat triangle: no two closer than `minGap`.
 * `next` is the seeded generator, so both devices set up the same pins. If the area gets too crowded
 * for the gap, the remaining pins fall back to a loose grid so there are always `count` of them.
 */
export function scatterPins(next: () => number, count: number, xMin: number, xMax: number, dyMax: number, minGap: number): Scatter[] {
  const out: Scatter[] = [];
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const p = { x: xMin + next() * (xMax - xMin), dy: (next() * 2 - 1) * dyMax };
      if (out.every((o) => Math.hypot(o.x - p.x, o.dy - p.dy) >= minGap)) {
        out.push(p);
        placed = true;
      }
    }
    if (!placed) out.push({ x: xMin + (i % 5) * ((xMax - xMin) / 4), dy: ((Math.floor(i / 5) % 2) * 2 - 1) * dyMax * 0.5 });
  }
  return out;
}
