import { describe, expect, it } from "vitest";
import { isOffPlatform, shrinksAtTurn, shrunkRadius, spawnPositions, warnsAtTurn } from "@/game/field/survivorGeometry";
import { MIN_RADIUS_RATIO, SHRINK_FACTOR } from "@/config/survivor";

const disc = { x: 800, y: 450, radius: 330 };

describe("survivorGeometry", () => {
  it("puts a bot out once its centre crosses the edge", () => {
    expect(isOffPlatform(800 + 329, 450, disc)).toBe(false);
    expect(isOffPlatform(800 + 331, 450, disc)).toBe(true);
    expect(isOffPlatform(800, 450 - 400, disc)).toBe(true);
  });

  it("shrinks every third turn and warns the turn before", () => {
    const shrinking = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(shrinksAtTurn);
    expect(shrinking).toEqual([4, 7, 10]);
    expect([1, 2, 3, 4, 5, 6].filter(warnsAtTurn)).toEqual([3, 6]);
    // The warning always lands on the turn right before a shrink.
    for (const t of [3, 6, 9]) expect(shrinksAtTurn(t + 1)).toBe(true);
  });

  it("shrinks by 12 % and stops at 40 % of the initial radius", () => {
    expect(shrunkRadius(330, 330)).toBeCloseTo(330 * SHRINK_FACTOR);
    let r = 330;
    for (let i = 0; i < 30; i++) r = shrunkRadius(r, 330);
    expect(r).toBeCloseTo(330 * MIN_RADIUS_RATIO);
  });

  it("spawns each team on its own side, inside the catwalk", () => {
    const red = spawnPositions("red", 3, disc);
    const yellow = spawnPositions("yellow", 3, disc);
    expect(red).toHaveLength(3);
    for (const p of red) {
      expect(p.x).toBeLessThan(disc.x);
      expect(isOffPlatform(p.x, p.y, disc)).toBe(false);
    }
    for (const p of yellow) expect(p.x).toBeGreaterThan(disc.x);
  });
});
