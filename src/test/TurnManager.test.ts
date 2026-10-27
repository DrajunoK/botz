import { describe, expect, it, vi } from "vitest";
import { TurnManager } from "@/game/TurnManager";

function tm(overrides: Partial<ConstructorParameters<typeof TurnManager>[0]> = {}) {
  return new TurnManager({
    aimDurationMs: 1000,
    resolveMaxDurationMs: 500,
    settleSpeedThreshold: 1,
    settleStableTicks: 3,
    goalsToWin: 3,
    ...overrides,
  });
}

describe("TurnManager", () => {
  it("starts in AIMING phase", () => {
    const t = tm();
    expect(t.phase).toBe("AIMING");
  });

  it("moves to RESOLVING when both teams are ready", () => {
    const t = tm();
    const resolveSpy = vi.fn();
    t.on("resolve", resolveSpy);
    t.setAim(1, 5, 0);
    t.setTeamReady("red");
    expect(t.phase).toBe("AIMING"); // only one team ready
    t.setTeamReady("yellow");
    expect(t.phase).toBe("RESOLVING");
    expect(resolveSpy).toHaveBeenCalledWith([{ botUid: 1, vx: 5, vy: 0 }]);
  });

  it("moves to RESOLVING when the aim timer expires, even if nobody is ready", () => {
    const t = tm({ aimDurationMs: 100 });
    t.update(150, [0]);
    expect(t.phase).toBe("RESOLVING");
  });

  it("does not double count multiple setTeamReady calls for the same team", () => {
    const t = tm();
    const resolveSpy = vi.fn();
    t.on("resolve", resolveSpy);
    t.setTeamReady("red");
    t.setTeamReady("red");
    t.setTeamReady("red");
    expect(t.phase).toBe("AIMING");
    t.setTeamReady("yellow");
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it("transitions RESOLVING -> AIMING once speeds settle for N consecutive ticks", () => {
    const t = tm({ settleStableTicks: 3, resolveMaxDurationMs: 10_000 });
    t.setTeamReady("red");
    t.setTeamReady("yellow");
    expect(t.phase).toBe("RESOLVING");

    t.update(16, [50]); // still moving
    expect(t.phase).toBe("RESOLVING");
    t.update(16, [0.5]); // tick 1 under threshold
    t.update(16, [0.5]); // tick 2
    expect(t.phase).toBe("RESOLVING");
    t.update(16, [0.5]); // tick 3 -> settled
    expect(t.phase).toBe("AIMING");
  });

  it("resets the stable-tick streak if speed spikes back up", () => {
    const t = tm({ settleStableTicks: 3 });
    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.update(16, [0.5]);
    t.update(16, [0.5]);
    t.update(16, [50]); // spike resets streak
    t.update(16, [0.5]);
    t.update(16, [0.5]);
    expect(t.phase).toBe("RESOLVING");
    t.update(16, [0.5]);
    expect(t.phase).toBe("AIMING");
  });

  it("force-settles after resolveMaxDurationMs even if never fully still", () => {
    const t = tm({ resolveMaxDurationMs: 50, settleStableTicks: 1000 });
    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.update(30, [50]);
    expect(t.phase).toBe("RESOLVING");
    t.update(30, [50]);
    expect(t.phase).toBe("AIMING");
  });

  it("clears pending aims and ready flags when a new aim phase starts", () => {
    const t = tm({ resolveMaxDurationMs: 10 });
    t.setAim(1, 5, 5);
    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.update(20, [0]); // force settle -> new aim phase
    expect(t.phase).toBe("AIMING");
    expect(t.hasAim(1)).toBe(false);
  });

  it("reports a goal exactly once per resolution and updates score", () => {
    const t = tm();
    const goalSpy = vi.fn();
    t.on("goal", goalSpy);
    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.reportGoal("red");
    t.reportGoal("red"); // duplicate within same resolution: ignored
    t.reportGoal("yellow"); // also ignored: only first goal per resolution counts
    expect(t.score.red).toBe(1);
    expect(t.score.yellow).toBe(0);
    expect(goalSpy).toHaveBeenCalledTimes(1);
    expect(t.phase).toBe("GOAL_PAUSE");
  });

  it("declares game over once a team reaches goalsToWin", () => {
    const t = tm({ goalsToWin: 2 });
    const gameOverSpy = vi.fn();
    t.on("gameOver", gameOverSpy);

    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.reportGoal("red");
    t.resumeAfterGoal();
    expect(t.phase).toBe("AIMING");

    t.setTeamReady("red");
    t.setTeamReady("yellow");
    t.reportGoal("red");
    expect(t.phase).toBe("GAME_OVER");
    expect(gameOverSpy).toHaveBeenCalledWith("red");
  });

  it("ignores reportGoal outside of RESOLVING", () => {
    const t = tm();
    const goalSpy = vi.fn();
    t.on("goal", goalSpy);
    t.reportGoal("red"); // still AIMING
    expect(goalSpy).not.toHaveBeenCalled();
    expect(t.score.red).toBe(0);
  });

  it("resetAimTimer restarts the countdown without touching pending aims", () => {
    const t = tm({ aimDurationMs: 1000 });
    t.setAim(1, 3, 3);
    t.update(400, [0]);
    expect(t.aimTimeRemainingMs).toBeCloseTo(600);
    t.resetAimTimer();
    expect(t.aimTimeRemainingMs).toBe(1000);
    expect(t.hasAim(1)).toBe(true);
  });
});
