import { describe, expect, it } from "vitest";
import { Tournament, botKey } from "@/game/Tournament";
import { defaultTournamentGames } from "@/config/tournament";

const ALL = ["soccer", "survivor", "petanque"] as const;
const win = (game: (typeof ALL)[number], winner: "red" | "yellow", w = 2, l = 1) => ({
  game,
  winner,
  score: winner === "red" ? { red: w, yellow: l } : { red: l, yellow: w },
});

describe("Tournament", () => {
  it("plays the games in order", () => {
    const t = new Tournament({ games: ALL });
    expect(t.currentGame).toBe("soccer");
    t.record(win("soccer", "red"));
    expect(t.currentGame).toBe("survivor");
    expect(t.gameIndex).toBe(1);
    expect(t.isOver).toBe(false);
  });

  it("awards one trophy per game won", () => {
    const t = new Tournament({ games: ALL });
    t.record(win("soccer", "red"));
    t.record(win("survivor", "yellow", 1, 0));
    expect(t.trophies).toEqual({ red: 1, yellow: 1 });
    expect(t.leader).toBeNull();
  });

  it("always plays all 3 games, even at 2–0", () => {
    const t = new Tournament({ games: ALL });
    t.record(win("soccer", "red"));
    t.record(win("survivor", "red"));
    expect(t.isOver).toBe(false);
    expect(t.winner).toBeNull();
    expect(t.currentGame).toBe("petanque");
    t.record(win("petanque", "yellow", 3, 1));
    expect(t.isOver).toBe(true);
    expect(t.trophies).toEqual({ red: 2, yellow: 1 });
    expect(t.winner).toBe("red");
  });

  it("rejects results out of order, a bad winner, or after the end", () => {
    const t = new Tournament({ games: ["soccer"] });
    expect(() => t.record(win("petanque", "red"))).toThrow();
    expect(() => t.record({ game: "soccer", winner: "red", score: { red: 1, yellow: 1 } })).toThrow();
    t.record(win("soccer", "red"));
    expect(() => t.record(win("soccer", "red"))).toThrow();
  });

  it("repairs botz between games by default", () => {
    const t = new Tournament({ games: ALL });
    t.record(win("soccer", "red"), { [botKey("red", 0)]: ["wheel"] });
    expect(t.startingParts("red", 0)).toBeNull();
  });

  it("carries lost parts over when repairBetweenGames is off", () => {
    const t = new Tournament({ games: ALL, repairBetweenGames: false });
    t.record(win("soccer", "red"), { [botKey("red", 0)]: ["wheel"], [botKey("yellow", 1)]: [] });
    expect(t.startingParts("red", 0)).toEqual(["wheel"]);
    expect(t.startingParts("yellow", 1)).toEqual([]);
    expect(t.startingParts("red", 2)).toBeNull();
  });

  it("only schedules playable games by default", () => {
    const t = new Tournament();
    expect(t.games).toEqual(defaultTournamentGames());
    expect(t.games.length).toBeGreaterThan(0);
  });
});
