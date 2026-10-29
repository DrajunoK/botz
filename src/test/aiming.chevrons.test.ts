import { describe, expect, it } from "vitest";
import { chevronColor, chevronCount, chevronPolygon } from "@/game/aiming";
import { BOT_RADIUS, MAX_AIM_DISTANCE } from "@/config/physics";

describe("chevronCount", () => {
  it("is max(1, round(power * 10))", () => {
    expect(chevronCount(1)).toBe(1);
    expect(chevronCount(MAX_AIM_DISTANCE * 0.3)).toBe(3);
    expect(chevronCount(MAX_AIM_DISTANCE * 0.6)).toBe(6);
    expect(chevronCount(MAX_AIM_DISTANCE)).toBe(10);
    expect(chevronCount(MAX_AIM_DISTANCE * 3)).toBe(10);
  });
});

describe("chevronPolygon", () => {
  it("last chevron touches the range circle", () => {
    const tip = Math.max(...chevronPolygon(9, BOT_RADIUS).map((p) => p.x));
    expect(Math.abs(tip - MAX_AIM_DISTANCE)).toBeLessThan(BOT_RADIUS * 0.2);
  });

  it("matches the spec for a radius-18 bot", () => {
    const pts = chevronPolygon(0, 18);
    expect(pts[5]).toEqual({ x: 26, y: 0 });
    expect(pts[0]).toEqual({ x: 22.5, y: -3.5 });
  });
});

describe("chevronColor", () => {
  it("runs from green to red along the range", () => {
    const red = (c: number) => (c >> 16) & 255;
    const green = (c: number) => (c >> 8) & 255;
    expect(red(chevronColor(0))).toBeLessThan(0x90);
    expect(green(chevronColor(0))).toBeGreaterThan(0xc0);
    expect(red(chevronColor(9))).toBeGreaterThan(0xe0);
    expect(green(chevronColor(9))).toBeLessThan(0x80);
  });
});
