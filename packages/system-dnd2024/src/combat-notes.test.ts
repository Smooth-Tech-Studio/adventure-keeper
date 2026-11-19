import { describe, expect, it } from "vitest";
import { bonusActionOptions, combatNotes } from "./combat-notes";

describe("combatNotes", () => {
  it("scales the Barbarian's Rage damage (2024)", () => {
    expect(combatNotes("barbarian", 1)[0]).toContain("+2 aux dégâts");
    expect(combatNotes("barbarian", 9)[0]).toContain("+3 aux dégâts");
    expect(combatNotes("barbarian", 16)[0]).toContain("+4 aux dégâts");
  });

  it("scales the Rogue's Sneak Attack dice", () => {
    expect(combatNotes("rogue", 1)[0]).toContain("+1d6");
    expect(combatNotes("rogue", 5)[0]).toContain("+3d6");
    expect(combatNotes("rogue", 20)[0]).toContain("+10d6");
  });

  it("reminds the Ranger of Hunter's Mark and the Paladin of Divine Smite", () => {
    expect(combatNotes("ranger", 1).join(" ")).toContain("Marque du chasseur");
    expect(combatNotes("paladin", 2).join(" ")).toContain("Châtiment divin");
  });

  it("is empty for a class with no automatic damage modifier", () => {
    expect(combatNotes("wizard", 10)).toEqual([]);
    expect(combatNotes("fighter", 5)).toEqual([]);
  });
});

describe("bonusActionOptions", () => {
  it("lists automatic base-class bonus actions by level", () => {
    expect(bonusActionOptions({ classId: "barbarian", level: 1 })).toContain("Entrer en rage");
    expect(bonusActionOptions({ classId: "fighter", level: 1 })).toEqual([]);
    expect(bonusActionOptions({ classId: "fighter", level: 2 })[0]).toContain("Second souffle");
    expect(bonusActionOptions({ classId: "monk", level: 1 })).toEqual([]);
    expect(bonusActionOptions({ classId: "monk", level: 2 }).join(" ")).toContain(
      "Rafale de coups",
    );
    expect(bonusActionOptions({ classId: "rogue", level: 2 })[0]).toContain("Ruse");
  });

  it("adds two-weapon fighting when carrying two light melee weapons", () => {
    expect(bonusActionOptions({ classId: "wizard", level: 1, lightMeleeWeapons: 1 })).toEqual([]);
    expect(bonusActionOptions({ classId: "wizard", level: 1, lightMeleeWeapons: 2 })).toEqual([
      "Attaquer avec une seconde arme légère (combat à deux armes)",
    ]);
  });
});
