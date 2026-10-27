import { describe, expect, it } from "vitest";
import { computeAim } from "@/game/aiming";
import { MAX_AIM_DISTANCE, MAX_SHOT_SPEED, MIN_AIM_DISTANCE } from "@/config/physics";

describe("computeAim", () => {
  it("returns zero vectors for a zero-length drag", () => {
    const result = computeAim(0, 0);
    expect(result.velocity).toEqual({ x: 0, y: 0 });
    expect(result.isValid).toBe(false);
  });

  it("is invalid below the minimum drag distance", () => {
    const result = computeAim(MIN_AIM_DISTANCE - 1, 0);
    expect(result.isValid).toBe(false);
  });

  it("is valid at or above the minimum drag distance", () => {
    const result = computeAim(MIN_AIM_DISTANCE, 0);
    expect(result.isValid).toBe(true);
  });

  it("points the velocity in the same direction as the drag", () => {
    const result = computeAim(100, 0);
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.y).toBeCloseTo(0);

    const diagonal = computeAim(-50, 50);
    expect(diagonal.velocity.x).toBeLessThan(0);
    expect(diagonal.velocity.y).toBeGreaterThan(0);
  });

  it("clamps drag length and velocity at MAX_AIM_DISTANCE / MAX_SHOT_SPEED", () => {
    const huge = computeAim(MAX_AIM_DISTANCE * 10, 0);
    expect(huge.distance).toBeCloseTo(MAX_AIM_DISTANCE);
    expect(huge.clamped.x).toBeCloseTo(MAX_AIM_DISTANCE);
    expect(Math.hypot(huge.velocity.x, huge.velocity.y)).toBeCloseTo(MAX_SHOT_SPEED);
  });

  it("scales power linearly with drag length below the cap", () => {
    const half = computeAim(MAX_AIM_DISTANCE / 2, 0);
    expect(Math.hypot(half.velocity.x, half.velocity.y)).toBeCloseTo(MAX_SHOT_SPEED / 2, 5);
  });
});
