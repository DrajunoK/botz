import { describe, expect, it } from "vitest";
import { hashNumbers, parseSyncTest } from "@/game/syncTest";

describe("hashNumbers", () => {
  it("is stable and sensitive to the last bit", () => {
    expect(hashNumbers([1, 2, 3])).toBe(hashNumbers([1, 2, 3]));
    expect(hashNumbers([1, 2, 3])).not.toBe(hashNumbers([1, 2, 3 + Number.EPSILON * 4]));
    expect(hashNumbers([1, 2])).not.toBe(hashNumbers([2, 1]));
  });
});

describe("parseSyncTest", () => {
  it("builds a solo match from the link", () => {
    const config = parseSyncTest("?synctest=soccer&seed=42&turns=5");
    expect(config).toMatchObject({ gameId: "soccer", seed: 42, syncTest: { turns: 5 } });
  });
  it("defaults the seed and turns", () => {
    expect(parseSyncTest("?synctest=petanque")).toMatchObject({ seed: 1, syncTest: { turns: 8 } });
  });
  it("ignores other links and unknown games", () => {
    expect(parseSyncTest("")).toBeNull();
    expect(parseSyncTest("?synctest=chess")).toBeNull();
  });
});
