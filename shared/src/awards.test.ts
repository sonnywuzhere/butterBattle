import { describe, expect, it } from "vitest";
import { computeKitchenAwards } from "./awards.js";

const names = { a: "Ada", b: "Bo", c: "Cam", d: "Dee" };

describe("computeKitchenAwards", () => {
  it("names Butteriest, Crowd Favorite, Burnt Toast, and Backup-Spread Survivor", () => {
    const awards = computeKitchenAwards({
      playerIds: ["a", "b", "c", "d"],
      names,
      matchups: [
        {
          authorA: "a",
          authorB: "b",
          winner: "A",
          votesA: 4,
          votesB: 0,
          backupA: false,
          backupB: true,
        },
        {
          authorA: "c",
          authorB: "d",
          winner: "A",
          votesA: 3,
          votesB: 1,
          backupA: true,
          backupB: false,
        },
        {
          authorA: "a",
          authorB: "c",
          winner: "A",
          votesA: 3,
          votesB: 1,
          backupA: false,
          backupB: false,
        },
        {
          authorA: "b",
          authorB: "d",
          winner: "B",
          votesA: 0,
          votesB: 4,
          backupA: false,
          backupB: false,
        },
      ],
      finale: [
        { playerId: "a", votes: 2 },
        { playerId: "d", votes: 1 },
        { playerId: "b", votes: 0 },
        { playerId: "c", votes: 0 },
      ],
    });
    const byId = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(byId.butteriest.playerId).toBe("a");
    expect(byId.crowd_favorite.playerId).toBe("a");
    expect(byId.burnt_toast.playerId).toBe("b");
    expect(byId.backup_survivor.playerId).toBe("c");
  });

  it("skips Backup-Spread Survivor when nobody won on a backup", () => {
    const awards = computeKitchenAwards({
      playerIds: ["a", "b"],
      names,
      matchups: [
        {
          authorA: "a",
          authorB: "b",
          winner: "A",
          votesA: 2,
          votesB: 0,
          backupA: false,
          backupB: false,
        },
      ],
      finale: [],
    });
    expect(awards.find((a) => a.id === "backup_survivor")).toBeUndefined();
  });
});
