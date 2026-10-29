import { describe, expect, it } from "vitest";
import { BotParts } from "@/game/entities/BotParts";
import { PARTS } from "@/config/parts";
import { Rng } from "@/game/Rng";

describe("BotParts", () => {
  it("starts with 4 parts, full mass and no handicap", () => {
    const p = new BotParts();
    expect(p.remaining).toHaveLength(4);
    expect(p.massFactor).toBe(1);
    expect(p.shotSpeedMultiplier).toBe(1);
    expect(p.driftRate).toBe(0);
    expect(p.aimErrorRad(new Rng(1))).toBe(0);
    expect(p.isWreck).toBe(false);
  });

  it("every lost part makes the bot lighter and faster off the line", () => {
    const p = new BotParts();
    p.lose("wheel");
    expect(p.massFactor).toBeCloseTo(1 - PARTS.massLossPerPart);
    p.lose("antenna");
    expect(p.massFactor).toBeCloseTo(1 - 2 * PARTS.massLossPerPart);
    expect(p.shotSpeedMultiplier).toBeCloseTo(1 + 2 * PARTS.shotSpeedBonusPerPart);
  });

  it("a missing antenna blurs aim within ±10°, but only then", () => {
    const p = new BotParts();
    p.lose("antenna");
    const rng = new Rng(3);
    let max = 0;
    for (let i = 0; i < 400; i++) max = Math.max(max, Math.abs(p.aimErrorRad(rng)));
    expect(max).toBeLessThanOrEqual((PARTS.antennaNoiseDeg * Math.PI) / 180);
    expect(max).toBeGreaterThan(0.05);
  });

  it("missing left arm curves right, missing right arm curves left, both cancel", () => {
    const left = new BotParts();
    left.lose("armLeft");
    expect(left.driftRate).toBeGreaterThan(0);
    const right = new BotParts();
    right.lose("armRight");
    expect(right.driftRate).toBeLessThan(0);
    right.lose("armLeft");
    expect(right.driftRate).toBe(0);
  });

  it("loseRandom picks among remaining parts only, and ends as a wreck", () => {
    const p = new BotParts();
    const rng = new Rng(11);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const lost = p.loseRandom(rng);
      expect(lost).not.toBeNull();
      expect(seen.has(lost!)).toBe(false);
      seen.add(lost!);
    }
    expect(p.isWreck).toBe(true);
    expect(p.loseRandom(rng)).toBeNull();
  });

  it("a wreck is much less accurate than a bot that only lost its antenna", () => {
    const wreck = new BotParts();
    for (const part of [...wreck.remaining]) wreck.lose(part);
    const antennaOnly = new BotParts();
    antennaOnly.lose("antenna");
    const spread = (parts: BotParts) => {
      const rng = new Rng(9);
      let max = 0;
      for (let i = 0; i < 500; i++) max = Math.max(max, Math.abs(parts.aimErrorRad(rng)));
      return max;
    };
    expect(spread(wreck)).toBeGreaterThan(spread(antennaOnly));
  });

  it("repair restores everything", () => {
    const p = new BotParts();
    p.lose("antenna");
    p.lose("wheel");
    p.repair();
    expect(p.remaining).toHaveLength(4);
  });
});
