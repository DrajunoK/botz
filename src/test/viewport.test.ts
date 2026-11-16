import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { MAX_GAME_WIDTH, WORLD_LEFT, gameWidthForAspect } from "@/config/viewport";

describe("gameWidthForAspect", () => {
  it("keeps the design width on 16:9", () => {
    expect(gameWidthForAspect(16 / 9)).toBe(GAME_WIDTH);
  });

  it("never goes below the design width on narrower screens", () => {
    expect(gameWidthForAspect(4 / 3)).toBe(GAME_WIDTH);
    expect(gameWidthForAspect(9 / 16)).toBe(GAME_WIDTH);
  });

  it("grows with the aspect ratio on wide phones", () => {
    expect(gameWidthForAspect(20 / 9)).toBe(2000);
  });

  it("is capped on ultra-wide screens", () => {
    expect(gameWidthForAspect(32 / 9)).toBe(MAX_GAME_WIDTH);
  });

  it("falls back to the design width on invalid input", () => {
    expect(gameWidthForAspect(NaN)).toBe(GAME_WIDTH);
    expect(gameWidthForAspect(0)).toBe(GAME_WIDTH);
  });
});

describe("world bounds", () => {
  it("centres the design area in the widest visible area", () => {
    expect(WORLD_LEFT).toBe((GAME_WIDTH - MAX_GAME_WIDTH) / 2);
    expect(GAME_WIDTH - WORLD_LEFT).toBe(WORLD_LEFT + MAX_GAME_WIDTH);
    expect(GAME_HEIGHT).toBe(900);
  });
});
