import { describe, expect, it } from "vitest";
import { Rng } from "@/game/Rng";
import { inPit, pickBoltSpots, pileSpot } from "@/game/boulons";
import { PIT, mirrorX } from "@/config/boulons";

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
      expect(inPit(PIT.red, p.x, p.y, -30) || inPit(PIT.yellow, p.x, p.y, -30)).toBe(false);
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
  it("tells whether a centre is far enough inside a pit to fall", () => {
    const p = { x: 100, y: 100, r: 50 };
    expect(inPit(p, 100, 100, 10)).toBe(true);
    expect(inPit(p, 145, 100, 10)).toBe(false);
    expect(inPit(p, 145, 100)).toBe(true);
  });
  it("lays a pile out inside the pit without stacking bolts", () => {
    const spots = Array.from({ length: 20 }, (_, i) => pileSpot(i, 76, 26));
    for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(76);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(8);
    }
  });
});
