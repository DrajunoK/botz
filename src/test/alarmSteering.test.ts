import { describe, expect, it } from "vitest";
import { computeFleeDirection } from "@/game/alarmSteering";
import { RoundedRect, wallInfo } from "@/game/field/fieldGeometry";
import { Rng } from "@/game/Rng";
import { ALARM } from "@/config/alarmClock";

const FIELD: RoundedRect = { left: 190, right: 1410, top: 130, bottom: 770, radius: 190 };

describe("wallInfo", () => {
  it("measures distance to straight edges, with the normal pointing inwards", () => {
    const w = wallInfo(FIELD, 800, 150);
    expect(w.distance).toBeCloseTo(20);
    expect(w.normal.x).toBeCloseTo(0);
    expect(w.normal.y).toBeCloseTo(1);
  });

  it("measures distance to rounded corners", () => {
    const corner = { x: FIELD.left + FIELD.radius, y: FIELD.top + FIELD.radius };
    const w = wallInfo(FIELD, corner.x - 100, corner.y - 100);
    expect(w.distance).toBeCloseTo(FIELD.radius - Math.hypot(100, 100));
    expect(w.normal.x).toBeGreaterThan(0);
    expect(w.normal.y).toBeGreaterThan(0);
  });

  it("works in the middle of the pitch", () => {
    expect(wallInfo(FIELD, 800, 450).distance).toBeGreaterThan(300);
  });
});

describe("computeFleeDirection", () => {
  const unit = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

  it("runs away from the nearest bot (within the jitter cone)", () => {
    const clock = { x: 800, y: 450 };
    const bots = [{ x: 600, y: 450 }, { x: 1300, y: 450 }];
    for (let seed = 0; seed < 50; seed++) {
      const d = computeFleeDirection({ clock, bots, field: FIELD, stuck: false, rng: new Rng(seed) });
      expect(unit(d)).toBeCloseTo(1);
      const angle = Math.abs(Math.atan2(d.y, d.x));
      expect(angle).toBeLessThanOrEqual(((ALARM.fleeJitterDeg + 0.5) * Math.PI) / 180);
    }
  });

  it("slides along a wall instead of charging into it", () => {
    // Clock hugging the top wall, bot below it: fleeing "up" would hit the wall.
    const clock = { x: 800, y: 145 };
    const bots = [{ x: 800, y: 260 }];
    for (let seed = 0; seed < 50; seed++) {
      const d = computeFleeDirection({ clock, bots, field: FIELD, stuck: false, rng: new Rng(seed) });
      expect(d.y).toBeGreaterThanOrEqual(0); // never pushes into the wall (inward normal is +y)
      expect(Math.abs(d.x)).toBeGreaterThan(0.5); // mostly sideways
    }
  });

  it("heads for the center when stuck in a corner", () => {
    const clock = { x: 215, y: 155 };
    const d = computeFleeDirection({ clock, bots: [{ x: 400, y: 300 }], field: FIELD, stuck: true, rng: new Rng(2) });
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    const input = { clock: { x: 700, y: 400 }, bots: [{ x: 500, y: 380 }], field: FIELD, stuck: false };
    expect(computeFleeDirection({ ...input, rng: new Rng(4) })).toEqual(computeFleeDirection({ ...input, rng: new Rng(4) }));
  });
});
