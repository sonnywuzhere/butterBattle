import { describe, expect, it } from "vitest";
import {
  scoreMatchup,
  scoreFinale,
  lastPlaceIds,
  renderFinaleAnswer,
  hotOffThePanWinners,
  SPEED_BONUS,
  ROUND_POOL,
  SWEEP_BONUS,
} from "./scoring.js";

const base = {
  eligible: 4,
  round: 1 as const,
  doubleButterA: false,
  doubleButterB: false,
  streakA: 0,
  streakB: 0,
  doubleButterEnabled: true,
  onARollEnabled: true,
};

describe("scoreMatchup", () => {
  it("splits the pool by share of eligible votes", () => {
    const r = scoreMatchup({ ...base, votesA: 3, votesB: 1 });
    expect(r.winner).toBe("A");
    expect(r.pointsA).toBe(750);
    expect(r.pointsB).toBe(250);
    expect(r.calloutsA).toEqual([]);
  });

  it("awards Butter'd when every eligible vote is won", () => {
    const r = scoreMatchup({ ...base, votesA: 4, votesB: 0 });
    expect(r.winner).toBe("A");
    expect(r.pointsA).toBe(ROUND_POOL[1] + SWEEP_BONUS[1]);
    expect(r.calloutsA).toContain("Butter'd!");
    expect(r.pointsB).toBe(0);
  });

  it("does not Butter'd if someone sat out", () => {
    const r = scoreMatchup({ ...base, votesA: 3, votesB: 0 });
    expect(r.winner).toBe("A");
    expect(r.pointsA).toBe(750);
    expect(r.calloutsA).not.toContain("Butter'd!");
  });

  it("Spread Thin zeros both sides and resets streaks", () => {
    const r = scoreMatchup({ ...base, votesA: 2, votesB: 2, streakA: 3, streakB: 1 });
    expect(r.winner).toBe("tie");
    expect(r.pointsA).toBe(0);
    expect(r.pointsB).toBe(0);
    expect(r.newStreakA).toBe(0);
    expect(r.newStreakB).toBe(0);
    expect(r.calloutsA[0]).toMatch(/Spread Thin/);
  });

  it("doubles a winning Double Butter", () => {
    const r = scoreMatchup({ ...base, votesA: 3, votesB: 1, doubleButterA: true });
    expect(r.pointsA).toBe(1500);
    expect(r.calloutsA).toContain("Double Butter paid off");
  });

  it("subtracts the stake from a losing Double Butter and floors at 0", () => {
    const r = scoreMatchup({ ...base, votesA: 3, votesB: 1, doubleButterB: true });
    expect(r.pointsB).toBe(0);
    expect(r.calloutsB).toContain("Double Butter burned");
  });

  it("applies On a Roll on the second consecutive win", () => {
    const r = scoreMatchup({ ...base, votesA: 3, votesB: 1, streakA: 1 });
    expect(r.newStreakA).toBe(2);
    expect(r.pointsA).toBe(Math.round(750 * 1.1));
    expect(r.calloutsA).toContain("On a Roll ×1.1");
  });

  it("applies On a Roll ×1.2 on the third consecutive win", () => {
    const r = scoreMatchup({ ...base, votesA: 4, votesB: 0, streakA: 2 });
    expect(r.newStreakA).toBe(3);
    expect(r.calloutsA).toContain("On a Roll ×1.2");
    expect(r.pointsA).toBe(Math.round((1000 + 250) * 1.2));
  });

  it("applies Double Butter before On a Roll", () => {
    const r = scoreMatchup({
      ...base,
      votesA: 3,
      votesB: 1,
      doubleButterA: true,
      streakA: 1,
    });
    // 750 * 2 = 1500, then * 1.1 = 1650
    expect(r.pointsA).toBe(1650);
    expect(r.calloutsA).toEqual(["Double Butter paid off", "On a Roll ×1.1"]);
  });

  it("uses round 2 pool and bonuses", () => {
    const r = scoreMatchup({ ...base, round: 2, votesA: 4, votesB: 0 });
    expect(r.pointsA).toBe(2000 + 500);
  });
});

describe("scoreFinale", () => {
  it("gives the pool to the plurality winner and consolation to second", () => {
    const rows = scoreFinale({
      entries: [
        { playerId: "a", votes: 3 },
        { playerId: "b", votes: 2 },
        { playerId: "c", votes: 0 },
        { playerId: "d", votes: 0 },
      ],
      lastPlaceIds: ["c"],
      comebackBoost: false,
    });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    expect(byId.a.points).toBe(2000);
    expect(byId.b.points).toBe(500);
    expect(byId.c.points).toBe(0);
  });

  it("splits the pool on a tie for first", () => {
    const rows = scoreFinale({
      entries: [
        { playerId: "a", votes: 2 },
        { playerId: "b", votes: 2 },
        { playerId: "c", votes: 1 },
      ],
      lastPlaceIds: ["c"],
      comebackBoost: false,
    });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    expect(byId.a.points).toBe(1000);
    expect(byId.b.points).toBe(1000);
    expect(byId.c.points).toBe(500);
  });

  it("applies Underdough only to last place finale points", () => {
    const rows = scoreFinale({
      entries: [
        { playerId: "a", votes: 3 },
        { playerId: "b", votes: 1 },
      ],
      lastPlaceIds: ["b"],
      comebackBoost: true,
    });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    expect(byId.a.points).toBe(2000);
    expect(byId.b.points).toBe(Math.round(500 * 1.25));
    expect(byId.b.callouts).toContain("Underdough ×1.25");
  });
});

describe("lastPlaceIds", () => {
  it("returns every player tied for last", () => {
    expect(
      lastPlaceIds([
        { id: "a", score: 100 },
        { id: "b", score: 10 },
        { id: "c", score: 10 },
      ]),
    ).toEqual(["b", "c"]);
  });
});

describe("hotOffThePanWinners", () => {
  it("takes the first ceil(N/2) non-backup finishers", () => {
    const ids = hotOffThePanWinners(
      [
        { playerId: "a", submittedAt: 30, usedBackup: false },
        { playerId: "b", submittedAt: 10, usedBackup: false },
        { playerId: "c", submittedAt: 20, usedBackup: true },
        { playerId: "d", submittedAt: 40, usedBackup: false },
      ],
      4,
    );
    expect(ids).toEqual(["b", "a"]);
    expect(SPEED_BONUS[1]).toBe(100);
    expect(SPEED_BONUS[2]).toBe(200);
  });

  it("ignores backups even if they 'finish' first", () => {
    const ids = hotOffThePanWinners(
      [
        { playerId: "a", submittedAt: 1, usedBackup: true },
        { playerId: "b", submittedAt: 50, usedBackup: false },
      ],
      4,
    );
    expect(ids).toEqual(["b"]);
  });
});

describe("renderFinaleAnswer", () => {
  it("fills Triple Churn blanks", () => {
    expect(
      renderFinaleAnswer("triple_churn", "____, ____, and a stick of ____", [
        "chaos",
        "garlic",
        "revenge",
      ]),
    ).toBe("chaos, garlic, and a stick of revenge");
  });

  it("joins Three Spreads with dots", () => {
    expect(renderFinaleAnswer("three_spreads", "unused", ["a", "b", "c"])).toBe("a · b · c");
  });
});
