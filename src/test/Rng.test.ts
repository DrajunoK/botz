import { describe, expect, it } from "vitest";
import { Rng } from "@/game/Rng";

describe("Rng", () => {
  it("is reproducible from its seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it("differs between seeds", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("stays within [0, 1) and its helper ranges", () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Math.abs(r.spread(10))).toBeLessThanOrEqual(10);
      expect(r.int(4)).toBeLessThan(4);
    }
  });

  it("forks are independent of later draws on the parent", () => {
    const a = new Rng(5);
    const fork = a.fork();
    const first = fork.next();
    const b = new Rng(5);
    const forkB = b.fork();
    b.next();
    b.next();
    expect(forkB.next()).toBe(first);
  });
});
