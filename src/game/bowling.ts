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
