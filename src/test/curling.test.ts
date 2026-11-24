import { describe, expect, it } from "vitest";
import { scoreCurlingEnd } from "@/game/curling";

const c = { x: 0, y: 0 };
const bot = (uid: number, team: "red" | "yellow", x: number, y = 0) => ({ uid, team, x, y });

describe("curling end", () => {
  it("scores several points for botz closer than the opponent's best", () => {
    const r = scoreCurlingEnd(c, 200, [bot(1, "red", 20), bot(2, "red", 60), bot(3, "yellow", 100), bot(4, "red", 150)]);
    expect(r.winner).toBe("red");
    expect(r.points).toBe(2);
  });
  it("ignores botz outside the house", () => {
    const r = scoreCurlingEnd(c, 200, [bot(1, "red", 300), bot(2, "yellow", 150)]);
    expect(r.winner).toBe("yellow");
    expect(r.points).toBe(1);
  });
  it("scores nothing when nobody is in the house", () => {
    const r = scoreCurlingEnd(c, 200, [bot(1, "red", 300), bot(2, "yellow", -400)]);
    expect(r.winner).toBeNull();
  });
});
