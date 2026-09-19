import { describe, expect, it } from "vitest";
import { dealRound, promptsForPlayer, validateDeal } from "./pairing.js";

describe("dealRound", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    it(`deals a valid round-robin for ${n} players`, () => {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const texts = ids.map((_, i) => `Prompt ${i}`);
      const dealt = dealRound(ids, texts);
      expect(validateDeal(ids, dealt)).toEqual([]);
      for (const id of ids) {
        expect(promptsForPlayer(dealt, id)).toHaveLength(2);
      }
      for (const d of dealt) {
        expect(d.authorIds[0]).not.toBe(d.authorIds[1]);
      }
    });
  }

  it("pairs neighbors in a circle", () => {
    const ids = ["a", "b", "c", "d"];
    const dealt = dealRound(ids, ["w", "x", "y", "z"]);
    expect(dealt[0].authorIds).toEqual(["a", "b"]);
    expect(dealt[1].authorIds).toEqual(["b", "c"]);
    expect(dealt[2].authorIds).toEqual(["c", "d"]);
    expect(dealt[3].authorIds).toEqual(["d", "a"]);
  });
});
