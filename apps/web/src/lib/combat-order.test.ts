import { describe, expect, it } from "vitest";

import { nextTurn, withAdded, withRemoved } from "@/lib/combat-order";

const combat = { round: 1, turnIndex: 1, order: ["a", "b", "c"] };

describe("combat order", () => {
  it("passes the turn, and starts a new round after the last", () => {
    expect(nextTurn(combat)).toEqual({ ...combat, turnIndex: 2 });
    expect(nextTurn({ ...combat, turnIndex: 2 })).toEqual({ ...combat, turnIndex: 0, round: 2 });
  });

  it("slots newcomers by initiative, the active one keeping its turn", () => {
    const scores = new Map([
      ["a", 18],
      ["b", 12],
      ["c", 5],
    ]);
    const next = withAdded(combat, [{ id: "d", initiative: 15 }], scores);
    expect(next.order).toEqual(["a", "d", "b", "c"]);
    expect(next.order[next.turnIndex]).toBe("b");
  });

  it("takes one out, and ends the fight with the last", () => {
    expect(withRemoved(combat, "a")).toEqual({ ...combat, order: ["b", "c"], turnIndex: 0 });
    expect(withRemoved({ round: 2, turnIndex: 0, order: ["a"] }, "a")).toBeNull();
  });
});
