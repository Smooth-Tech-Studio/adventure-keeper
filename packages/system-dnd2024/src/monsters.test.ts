import { describe, expect, it } from "vitest";
import { MONSTERS, monsterMeta, monsterSizes } from "./monsters";

describe("monster sizes", () => {
  it("lists only the sizes the bank uses, smallest first", () => {
    const sizes = monsterSizes();
    expect(sizes[0]).toBe("tiny");
    expect(sizes).toContain("medium");
    for (const monster of MONSTERS) expect(sizes).toContain(monster.size);
  });

  it("writes the size as its stat-block abbreviation in the meta line", () => {
    const goblin = MONSTERS.find((monster) => monster.id === "goblin")!;
    expect(monsterMeta(goblin)).toBe("Fée · P · FP 1/4");
  });
});
