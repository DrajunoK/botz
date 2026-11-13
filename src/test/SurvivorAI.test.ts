import { describe, expect, it } from "vitest";
import { SurvivorAI } from "@/game/SurvivorAI";
import { isOffPlatform } from "@/game/field/survivorGeometry";
import { BOT_PHYSICS } from "@/config/physics";

const platform = { x: 800, y: 450, radius: 330 };
const travel = (1 - BOT_PHYSICS.frictionAir) / BOT_PHYSICS.frictionAir;
const bot = (uid: number, x: number, y: number) => ({ uid, index: uid, x, y });
const ctx = (bots: ReturnType<typeof bot>[], opponentBots: ReturnType<typeof bot>[]) => ({
  bots,
  opponentBots,
  platform,
  difficulty: "hard" as const,
  rng: () => 0.5, // zero noise
});

describe("SurvivorAI", () => {
  it("shoots one vector per bot", () => {
    const shots = SurvivorAI.computeShots(ctx([bot(1, 600, 450), bot(2, 600, 350)], [bot(3, 1000, 450)]));
    expect(shots.map((s) => s.botUid)).toEqual([1, 2]);
  });

  it("pushes the enemy closest to the edge, outwards", () => {
    const shots = SurvivorAI.computeShots(ctx([bot(1, 700, 450)], [bot(2, 800, 450), bot(3, 1080, 450)]));
    // Both enemies are on the same line: the shot heads towards +x (the far one is the better target).
    expect(shots[0].vx).toBeGreaterThan(0);
    expect(Math.abs(shots[0].vy)).toBeLessThan(0.5);
  });

  it("does not aim to stop outside the catwalk", () => {
    const shots = SurvivorAI.computeShots(ctx([bot(1, 500, 450)], [bot(2, 1100, 450)]));
    const s = shots[0];
    const stop = { x: 500 + s.vx * travel, y: 450 + s.vy * travel };
    expect(isOffPlatform(stop.x, stop.y, platform)).toBe(false);
  });

  it("pulls a bot standing near the edge back towards the centre", () => {
    const shots = SurvivorAI.computeShots(ctx([bot(1, 1100, 450)], [bot(2, 700, 450)]));
    expect(shots[0].vx).toBeLessThan(0);
  });
});
