import { describe, expect, it } from "vitest";
import { PLAYER_COLORS, type Player } from "@butter/shared";
import { Kitchen } from "./room.js";
import { kitchenFromState, kitchenToState } from "./persist.js";

function host(): Player {
  return {
    id: "host-1",
    name: "Mary",
    color: PLAYER_COLORS[0],
    connected: true,
    score: 0,
    streak: 0,
    joinedAt: 1,
  };
}

describe("kitchen serialize", () => {
  it("round-trips lobby players and settings", () => {
    const k = new Kitchen("AB7K", host(), { rating: "spicy", timerSpeed: "fast" });
    k.addPlayer("Ada", PLAYER_COLORS[1]);
    k.phase = "lobby";
    const restored = kitchenFromState(kitchenToState(k));
    expect(restored.code).toBe("AB7K");
    expect(restored.settings.rating).toBe("spicy");
    expect(restored.settings.timerSpeed).toBe("fast");
    expect(restored.playerList().map((p) => p.name).sort()).toEqual(["Ada", "Mary"]);
    expect(restored.sockets.size).toBe(0);
    expect(restored.players.get("host-1")?.connected).toBe(false);
  });

  it("keeps scores, phase, and remaining timer", () => {
    const k = new Kitchen("ZZZZ", host(), {});
    const p = k.players.get("host-1")!;
    p.score = 1750;
    k.phase = "round_score";
    k.round = 2;
    k.timerEndsAt = Date.now() + 8000;
    const restored = kitchenFromState(kitchenToState(k));
    expect(restored.phase).toBe("round_score");
    expect(restored.round).toBe(2);
    expect(restored.players.get("host-1")?.score).toBe(1750);
    expect(restored.timerEndsAt).toBeGreaterThan(Date.now() + 1000);
    expect(restored.timerEndsAt!).toBeLessThan(Date.now() + 9000);
  });
});
