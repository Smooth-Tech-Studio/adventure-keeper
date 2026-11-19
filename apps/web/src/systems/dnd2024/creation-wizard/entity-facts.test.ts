import { describe, expect, it } from "vitest";

import { circularOffset } from "@/systems/dnd2024/creation-wizard/entity-facts";

describe("circularOffset", () => {
  it("puts the last card just left of the first one", () => {
    expect(circularOffset(11, 0, 12)).toBe(-1);
    expect(circularOffset(1, 0, 12)).toBe(1);
  });

  it("puts the first card just right of the last one", () => {
    expect(circularOffset(0, 11, 12)).toBe(1);
  });

  it("keeps a card in the middle of the deck where it is", () => {
    expect(circularOffset(5, 3, 12)).toBe(2);
    expect(circularOffset(3, 5, 12)).toBe(-2);
  });

  it("sends the far side of an even deck to the right", () => {
    expect(circularOffset(6, 0, 12)).toBe(6);
    expect(circularOffset(1, 0, 2)).toBe(1);
  });
});
