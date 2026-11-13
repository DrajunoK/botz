import { describe, expect, it } from "vitest";
import { estimateTravelDistance, scoreEnd, speedForDistance } from "@/game/petanque";
import { PetanqueAI } from "@/game/PetanqueAI";
import { MAX_SHOT_SPEED } from "@/config/physics";
import { PLAY_RECT, CIRCLE_CENTER } from "@/config/petanque";

const jack = { x: 1000, y: 450 };
const R = 34;
const J = 30;
// A bot whose edge-to-edge distance to the jack is `d`, straight left of it.
const at = (uid: number, team: "red" | "yellow", d: number, dy = 0) => ({ uid, team, x: jack.x - (d + R + J), y: jack.y + dy });

describe("scoreEnd", () => {
  it("gives the closest team one point per bot closer than the opponent's best", () => {
    const r = scoreEnd(jack, [at(1, "red", 20), at(2, "red", 50), at(3, "red", 200), at(4, "yellow", 80), at(5, "yellow", 90)], R, J);
    expect(r.winner).toBe("red");
    expect(r.points).toBe(2);
    expect(r.scoringUids.sort()).toEqual([1, 2]);
    expect(r.ranked[0].bot.uid).toBe(1);
  });

  it("scores a single point when only the best bot beats the opponent", () => {
    const r = scoreEnd(jack, [at(1, "yellow", 30), at(2, "yellow", 150), at(3, "red", 100)], R, J);
    expect(r).toMatchObject({ winner: "yellow", points: 1 });
  });

  it("scores every bot of a team when the opponent has none on the court", () => {
    const r = scoreEnd(jack, [at(1, "red", 40), at(2, "red", 300), at(3, "red", 500)], R, J);
    expect(r).toMatchObject({ winner: "red", points: 3 });
  });

  it("is a null end when the two best botz are exactly level", () => {
    const r = scoreEnd(jack, [at(1, "red", 50, 0), { ...at(2, "yellow", 50), y: jack.y + 0 , x: jack.x + (50 + R + J) }], R, J);
    expect(r.winner).toBeNull();
    expect(r.points).toBe(0);
  });

  it("measures edge to edge, not centre to centre", () => {
    const r = scoreEnd(jack, [at(1, "red", 10)], R, J);
    expect(r.ranked[0].distance).toBeCloseTo(10);
  });

  it("handles an empty court", () => {
    expect(scoreEnd(jack, [], R, J)).toMatchObject({ winner: null, points: 0 });
  });
});

describe("throw calibration", () => {
  it("speedForDistance inverts estimateTravelDistance", () => {
    for (const d of [100, 400, 800]) expect(estimateTravelDistance(speedForDistance(d))).toBeCloseTo(d, 3);
  });

  it("the strongest throw reaches the far end of the court", () => {
    const farthest = PLAY_RECT.right - CIRCLE_CENTER.red.x;
    expect(estimateTravelDistance(MAX_SHOT_SPEED)).toBeGreaterThan(farthest);
  });
});

describe("PetanqueAI", () => {
  const bot = { uid: 9, index: 0, x: 300, y: 450 };
  const base = { bots: [bot], ownBots: [], opponentBots: [], jack, difficulty: "hard" as const, rng: () => 0.5 };

  it("points at the jack and stops short of it", () => {
    const [s] = PetanqueAI.computeShots(base);
    expect(s.vx).toBeGreaterThan(0);
    expect(estimateTravelDistance(Math.hypot(s.vx, s.vy))).toBeLessThan(700);
    expect(estimateTravelDistance(Math.hypot(s.vx, s.vy))).toBeGreaterThan(500);
  });

  it("shoots at an opponent bot sitting right next to the jack when it leads", () => {
    const opp = { uid: 7, index: 0, x: 960, y: 450 };
    const own = { uid: 8, index: 1, x: 700, y: 300 };
    const [s] = PetanqueAI.computeShots({ ...base, opponentBots: [opp], ownBots: [own] });
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(MAX_SHOT_SPEED * 0.9);
  });

  it("keeps pointing when its own bot already leads", () => {
    const opp = { uid: 7, index: 0, x: 960, y: 450 };
    const own = { uid: 8, index: 1, x: 990, y: 450 };
    const [s] = PetanqueAI.computeShots({ ...base, opponentBots: [opp], ownBots: [own] });
    expect(Math.hypot(s.vx, s.vy)).toBeLessThan(MAX_SHOT_SPEED * 0.9);
  });
});
