import { describe, expect, it } from "vitest";
import { PanicTracker, panicLevelForTurn } from "@/game/Panic";

describe("panic levels", () => {
  it("follows the turn thresholds of the spec", () => {
    expect([1, 3].map(panicLevelForTurn)).toEqual([0, 0]);
    expect([4, 6].map(panicLevelForTurn)).toEqual([1, 1]);
    expect([7, 10].map(panicLevelForTurn)).toEqual([2, 2]);
    expect([11, 40].map(panicLevelForTurn)).toEqual([3, 3]);
  });
});

describe("PanicTracker", () => {
  it("rises as turns pass", () => {
    const p = new PanicTracker();
    expect(p.level).toBe(0);
    for (let i = 0; i < 3; i++) p.advance(); // turn 4
    expect(p.level).toBe(1);
    for (let i = 0; i < 3; i++) p.advance(); // turn 7
    expect(p.level).toBe(2);
  });

  it("drops one notch after a goal, then keeps rising", () => {
    const p = new PanicTracker(1);
    for (let i = 0; i < 10; i++) p.advance(); // turn 11 -> level 3
    expect(p.level).toBe(3);
    p.onGoal();
    p.advance(); // first aiming phase after the kickoff reset
    expect(p.level).toBe(2);
    for (let i = 0; i < 4; i++) p.advance();
    expect(p.level).toBe(3);
  });

  it("never drops below level 0", () => {
    const p = new PanicTracker(1);
    p.onGoal();
    p.advance();
    expect(p.level).toBe(0);
  });

  it("drop can be disabled", () => {
    const p = new PanicTracker(0);
    for (let i = 0; i < 10; i++) p.advance();
    p.onGoal();
    p.advance();
    expect(p.level).toBe(3);
  });
});
