import { describe, expect, it } from "vitest";

import { freeSpot } from "@/lib/map-tokens";

describe("freeSpot", () => {
  it("takes the centre when nobody stands there", () => {
    expect(freeSpot([])).toEqual({ x: 0.5, y: 0.5 });
    expect(freeSpot([{ x: 0.1, y: 0.1 }])).toEqual({ x: 0.5, y: 0.5 });
  });

  it("steps aside from the tokens already there", () => {
    const taken = [{ x: 0.5, y: 0.5 }];
    const second = freeSpot(taken);
    expect(Math.hypot(second.x - 0.5, second.y - 0.5)).toBeCloseTo(0.06);
    const third = freeSpot([...taken, second]);
    expect(third).not.toEqual(second);
    expect(Math.hypot(third.x - second.x, third.y - second.y)).toBeGreaterThanOrEqual(0.045);
  });
});

describe("freeSpot around a token", () => {
  it("drops a familiar beside its character, not in the middle of the map", () => {
    const owner = { x: 0.2, y: 0.8 };
    const spot = freeSpot([owner], owner);
    expect(Math.hypot(spot.x - owner.x, spot.y - owner.y)).toBeCloseTo(0.06);
  });

  it("stays on the map near an edge", () => {
    const corner = { x: 0, y: 0 };
    const spot = freeSpot([corner], corner);
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeGreaterThanOrEqual(0);
  });
});
