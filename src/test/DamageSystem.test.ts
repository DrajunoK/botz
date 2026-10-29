import { describe, expect, it } from "vitest";
import { DamageSystem } from "@/game/DamageSystem";
import { BotParts } from "@/game/entities/BotParts";
import { PARTS } from "@/config/parts";
import { Rng } from "@/game/Rng";

function setup(seed = 1) {
  const parts = new BotParts();
  const dmg = new DamageSystem(new Rng(seed));
  dmg.register(1, parts);
  return { parts, dmg };
}

describe("DamageSystem", () => {
  it("ignores soft hits", () => {
    const { parts, dmg } = setup();
    expect(dmg.onImpact(1, PARTS.impactSpeedThreshold - 0.1, 0)).toBeNull();
    expect(parts.lostCount).toBe(0);
  });

  it("knocks a part off on a hard hit", () => {
    const { parts, dmg } = setup();
    const lost = dmg.onImpact(1, PARTS.impactSpeedThreshold + 1, 0);
    expect(lost).not.toBeNull();
    expect(parts.has(lost!)).toBe(false);
    expect(parts.lostCount).toBe(1);
  });

  it("cooldown: two hard hits in quick succession cost only one part", () => {
    const { parts, dmg } = setup();
    dmg.onImpact(1, 20, 0);
    expect(dmg.onImpact(1, 20, PARTS.lossCooldownMs - 1)).toBeNull();
    expect(parts.lostCount).toBe(1);
    expect(dmg.onImpact(1, 20, PARTS.lossCooldownMs + 1)).not.toBeNull();
    expect(parts.lostCount).toBe(2);
  });

  it("a wreck has nothing left to lose", () => {
    const { parts, dmg } = setup();
    for (let i = 0; i < 4; i++) dmg.onImpact(1, 20, i * 1000);
    expect(parts.isWreck).toBe(true);
    expect(dmg.onImpact(1, 20, 10_000)).toBeNull();
  });

  it("unknown bots are ignored", () => {
    const { dmg } = setup();
    expect(dmg.onImpact(99, 50, 0)).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const run = (seed: number) => {
      const { dmg } = setup(seed);
      return [0, 1000, 2000].map((t) => dmg.onImpact(1, 20, t));
    };
    expect(run(8)).toEqual(run(8));
  });
});
