import { describe, expect, it } from "vitest";
import { bowlingWinner, inGutter, knockedIndexes, rackSpots } from "@/game/bowling";

describe("bowling", () => {
  it("lays out ten pins in a triangle around the lane centre", () => {
    const spots = rackSpots(1000, 300);
    expect(spots).toHaveLength(10);
    expect(spots[0]).toEqual({ x: 1000, y: 300 });
    expect(spots.slice(-4).every((s) => s.x === spots[9].x)).toBe(true);
    const ys = spots.slice(-4).map((s) => s.y);
    expect(ys[0] + ys[3]).toBeCloseTo(600);
  });
  it("counts pins moved off their spot or gone", () => {
    const spots = rackSpots(1000, 300);
    const pos = spots.map((s) => ({ ...s }));
    pos[3] = { x: spots[3].x + 60, y: spots[3].y };
    pos[5] = { x: spots[5].x + 3, y: spots[5].y };
    expect(knockedIndexes(spots, [...pos.slice(0, 7), null, ...pos.slice(8)])).toEqual([3, 7]);
  });
  it("tells a gutter ball", () => {
    expect(inGutter(300 + 140, 300, 136)).toBe(true);
    expect(inGutter(300 - 100, 300, 136)).toBe(false);
  });
  it("needs all frames played and a lead to end", () => {
    expect(bowlingWinner({ red: 20, yellow: 5 }, 4, 5)).toBeNull();
    expect(bowlingWinner({ red: 20, yellow: 20 }, 5, 5)).toBeNull();
    expect(bowlingWinner({ red: 21, yellow: 20 }, 5, 5)).toBe("red");
  });
});
