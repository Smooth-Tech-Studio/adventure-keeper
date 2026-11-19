import { describe, expect, it } from "vitest";

import { classFeatures } from "./features";
import { featureRollDice, formatFeatureRoll } from "./feature-rolls";
import { getSubclass } from "./subclasses";

const mods = { str: 0, dex: 3, con: 1, int: 0, wis: 2, cha: -1 };

describe("feature rolls", () => {
  it("Second souffle : 1d10 + le niveau de guerrier", () => {
    const wind = classFeatures("fighter", 4).find((f) => f.name === "Second souffle");
    expect(wind?.roll?.gives).toBe("hp");
    expect(
      formatFeatureRoll(wind!.roll!, { classId: "fighter", level: 4, abilityModifiers: mods }),
    ).toBe("1d10 + 4");
  });

  it("Métabolisme surnaturel : le dé d'arts martiaux + le niveau de moine", () => {
    const meta = classFeatures("monk", 5).find((f) => f.name === "Métabolisme surnaturel");
    expect(
      featureRollDice(meta!.roll!, { classId: "monk", level: 5, abilityModifiers: mods }),
    ).toEqual({
      pool: { count: 1, die: "d8" },
      bonus: 5,
    });
  });

  it("Défense patiente : deux dés d'arts martiaux en PV temporaires, un point de Credo", () => {
    const heightened = classFeatures("monk", 11).find((f) => f.name === "Credo accru");
    expect(heightened?.roll).toMatchObject({
      label: "Défense patiente",
      gives: "tempHp",
      spends: "monk:2:Credo du Moine",
    });
    expect(
      formatFeatureRoll(heightened!.roll!, { classId: "monk", level: 11, abilityModifiers: mods }),
    ).toBe("2d10");
  });

  it("Plénitude physique : le dé d'arts martiaux + la Sagesse", () => {
    const wholeness = getSubclass("monk:credo-de-la-paume")?.features.find(
      (f) => f.name === "Plénitude physique",
    );
    expect(
      formatFeatureRoll(wholeness!.roll!, { classId: "monk", level: 6, abilityModifiers: mods }),
    ).toBe("1d8 + 2");
  });
});
