import { describe, expect, it } from "vitest";
import { AIController, AIContext } from "@/game/AIController";
import { MAX_SHOT_SPEED } from "@/config/physics";

function baseContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    team: "red",
    bots: [
      { uid: 1, index: 0, x: 300, y: 450 },
      { uid: 2, index: 1, x: 500, y: 450 },
      { uid: 3, index: 2, x: 500, y: 600 },
    ],
    opponentBots: [
      { uid: 4, index: 0, x: 1300, y: 450 },
      { uid: 5, index: 1, x: 1100, y: 450 },
      { uid: 6, index: 2, x: 1100, y: 600 },
    ],
    ball: { x: 800, y: 450 },
    ownGoal: { x: 140, y: 450 },
    opponentGoal: { x: 1460, y: 450 },
    difficulty: "normal",
    turnNumber: 1,
    rng: () => 0.5, // deterministic: noise offsets become 0
    ...overrides,
  };
}

describe("AIController.computeShots", () => {
  it("produces one shot per bot", () => {
    const shots = AIController.computeShots(baseContext());
    expect(shots).toHaveLength(3);
    expect(new Set(shots.map((s) => s.botUid))).toEqual(new Set([1, 2, 3]));
  });

  it("never exceeds MAX_SHOT_SPEED", () => {
    for (let i = 0; i < 50; i++) {
      const shots = AIController.computeShots(baseContext({ rng: Math.random }));
      for (const s of shots) {
        expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(MAX_SHOT_SPEED + 1e-9);
      }
    }
  });

  it("aims the attacker roughly towards the opponent goal (via a point behind the ball)", () => {
    const shots = AIController.computeShots(baseContext());
    const attackerShot = shots.find((s) => s.botUid === 2)!;
    // Ball is between the attacker and the opponent goal on the x axis; with zero
    // noise (rng=0.5) the shot should point rightwards (towards the ball/goal).
    expect(attackerShot.vx).toBeGreaterThan(0);
  });

  it("aims the defender towards a point between the ball and its own goal", () => {
    const shots = AIController.computeShots(baseContext());
    const defenderShot = shots.find((s) => s.botUid === 1)!;
    // Defender at x=300, target is between ownGoal(140) and ball(800) closer to goal:
    // 140 + (800-140)*0.35 = 371, which is to the right of 300 -> positive vx.
    expect(defenderShot.vx).toBeGreaterThan(0);
  });

  it("alternates the support bot's role by turn number", () => {
    const supportOffense = AIController.computeShots(baseContext({ turnNumber: 2 }));
    const supportHarass = AIController.computeShots(baseContext({ turnNumber: 3 }));
    const shotOffense = supportOffense.find((s) => s.botUid === 3)!;
    const shotHarass = supportHarass.find((s) => s.botUid === 3)!;
    // Different targets (attack point near the ball vs. nearest opponent bot at x=1100)
    // should generally produce different direction vectors.
    expect(shotOffense).not.toEqual(shotHarass);
  });

  it("applies more angle noise on easy than on hard for the same non-neutral rng draw", () => {
    const rng = () => 0.9; // pushes the noise fully to one side
    const easy = AIController.computeShots(baseContext({ difficulty: "easy", rng }));
    const hard = AIController.computeShots(baseContext({ difficulty: "hard", rng }));
    const easyAttacker = easy.find((s) => s.botUid === 2)!;
    const hardAttacker = hard.find((s) => s.botUid === 2)!;
    const easyAngle = Math.atan2(easyAttacker.vy, easyAttacker.vx);
    const hardAngle = Math.atan2(hardAttacker.vy, hardAttacker.vx);
    const baseline = Math.atan2(0, 1); // rough reference, attacker mostly aims along +x
    expect(Math.abs(easyAngle - baseline)).toBeGreaterThan(Math.abs(hardAngle - baseline) * 0.5);
  });
});
