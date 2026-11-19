import { describe, expect, it } from "vitest";
import { characterSystemSatisfies } from "./character-system";

describe("characterSystemSatisfies", () => {
  it("a system always satisfies itself", () => {
    expect(characterSystemSatisfies("standard", "standard")).toBe(true);
    expect(characterSystemSatisfies("dnd2024", "dnd2024")).toBe(true);
  });

  it("dnd2024 is a superset of standard", () => {
    expect(characterSystemSatisfies("dnd2024", "standard")).toBe(true);
  });

  it("a standard character cannot join a dnd2024 campaign", () => {
    expect(characterSystemSatisfies("standard", "dnd2024")).toBe(false);
  });
});
