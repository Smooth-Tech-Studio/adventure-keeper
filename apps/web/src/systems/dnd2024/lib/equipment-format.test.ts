import { describe, expect, it } from "vitest";
import type { Item } from "@adventure-keeper/schemas";

import { armorTrainingWarning, weaponTrainingWarning } from "./equipment-format";

const longsword = {
  weapon: {
    category: "martial-melee",
    properties: ["versatile"],
    damageDice: { count: 1, die: "d8" },
    damageType: "slashing",
  },
} as Pick<Item, "weapon">;

const plate = {
  armor: { category: "heavy", baseAc: 18, equipped: false },
} as unknown as Pick<Item, "armor">;

describe("weaponTrainingWarning", () => {
  it("flags a martial weapon for a class without martial training", () => {
    expect(weaponTrainingWarning(longsword, "wizard")).toMatch(/Non maîtrisée/);
  });

  it("stays quiet for a trained class or an unknown class", () => {
    expect(weaponTrainingWarning(longsword, "fighter")).toBeNull();
    expect(weaponTrainingWarning(longsword, undefined)).toBeNull();
  });
});

describe("armorTrainingWarning", () => {
  it("flags heavy armour for a class without heavy training", () => {
    expect(armorTrainingWarning(plate, "wizard")).toMatch(/Non maîtrisée/);
  });

  it("stays quiet for a trained class", () => {
    expect(armorTrainingWarning(plate, "fighter")).toBeNull();
  });
});
