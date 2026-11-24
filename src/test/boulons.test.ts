import { describe, expect, it } from "vitest";
import { Rng } from "@/game/Rng";
import { inRect, pickBoltSpots } from "@/game/boulons";
import { ZONE, mirrorX } from "@/config/boulons";

describe("bolt spots", () => {
  it("gives every bolt a mirrored twin, away from the zones and each other", () => {
    const spots = pickBoltSpots(() => new Rng(5).next(), 1, []);
    expect(spots).toHaveLength(2);
    const rng = new Rng(7);
    const many = pickBoltSpots(() => rng.next(), 6, [{ x: 420, y: 450 }]);
    expect(many.length).toBeGreaterThan(8);
    for (let i = 0; i < many.length; i += 2) {
      expect(many[i + 1]).toEqual({ x: mirrorX(many[i].x), y: many[i].y });
    }
    for (const p of many) {
      expect(inRect(ZONE.red, p.x, p.y) || inRect(ZONE.yellow, p.x, p.y)).toBe(false);
    }
    for (let i = 0; i < many.length; i++) for (let j = i + 1; j < many.length; j++) {
      expect(Math.hypot(many[i].x - many[j].x, many[i].y - many[j].y)).toBeGreaterThanOrEqual(62);
    }
  });
  it("is the same for the same seed", () => {
    const a = new Rng(11);
    const b = new Rng(11);
    expect(pickBoltSpots(() => a.next(), 4, [])).toEqual(pickBoltSpots(() => b.next(), 4, []));
  });
  it("tells whether a point is in a zone", () => {
    expect(inRect(ZONE.red, 200, 500)).toBe(true);
    expect(inRect(ZONE.red, 800, 500)).toBe(false);
  });
});
