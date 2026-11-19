import { describe, expect, it } from "vitest";
import { CHARACTER_SYSTEMS, type ReadyCharacter } from "@adventure-keeper/schemas";

import { characterSystemFor, getSystem, soleSystemFor, systemOf } from "@/systems";

/** Only what the systems read — the rest of a sheet does not matter here. */
const dnd = (fields: Record<string, unknown> = {}) =>
  ({
    system: "dnd2024",
    speciesId: "elf",
    classId: "wizard",
    level: 3,
    abilityModifiers: { str: 0, dex: 2, con: 1, int: 3, wis: 0, cha: 0 },
    passivePerception: 12,
    ...fields,
  }) as unknown as ReadyCharacter;

const standard = { system: "standard", maxHitPoints: 8 } as unknown as ReadyCharacter;

describe("systems", () => {
  it("knows every character system", () => {
    for (const id of CHARACTER_SYSTEMS) expect(getSystem(id).id).toBe(id);
  });

  it("skips the choice of a system only when a campaign takes one", () => {
    expect(soleSystemFor("dnd2024")).toBe("dnd2024");
    // A standard campaign also takes 5e sheets.
    expect(soleSystemFor("standard")).toBeNull();
  });

  it("gives a 5e campaign the computed sheet, any other game the free one", () => {
    expect(characterSystemFor("dnd5e")).toBe("dnd2024");
    expect(characterSystemFor("custom")).toBe("standard");
  });

  it("shows the SRD attribution for 5e alone", () => {
    expect(getSystem("dnd2024").licenceNotice).toBe("srd521");
    expect(getSystem("standard").licenceNotice).toBeNull();
  });
});

describe("5e 2024", () => {
  it("reads the fight values off the sheet", () => {
    const character = dnd({ armorClass: 15, initiativeBonus: 4, size: "small" });
    expect(systemOf(character).combatStats(character)).toEqual({
      armorClass: 15,
      initiativeBonus: 4,
      passivePerception: 12,
      size: "small",
    });
  });

  it("falls back on Dexterity for a sheet derived before those values", () => {
    const character = dnd();
    const stats = systemOf(character).combatStats(character);
    expect(stats.armorClass).toBe(12);
    expect(stats.initiativeBonus).toBe(2);
  });

  it("names species, class and level under the character", () => {
    const character = dnd();
    expect(systemOf(character).subtitle(character)).toMatch(/ · .+ · niv\. 3$/);
  });

  it("counts experience from zero", () => {
    const character = dnd();
    expect(systemOf(character).experienceOf(character)).toBe(0);
    expect(systemOf(character).experienceOf(dnd({ experiencePoints: 300 }))).toBe(300);
  });

  it("gives the neutral answer for a sheet of another system", () => {
    const system = getSystem("dnd2024");
    expect(system.combatStats(standard)).toEqual({ initiativeBonus: 0 });
    expect(system.companions(standard)).toEqual([]);
    expect(system.experienceOf(standard)).toBeNull();
  });
});

describe("standard", () => {
  it("has no fight value, companion, personality nor experience", () => {
    const system = systemOf(standard);
    expect(system.combatStats(standard)).toEqual({ initiativeBonus: 0 });
    expect(system.companions(standard)).toEqual([]);
    expect(system.personalityOf(standard)).toBeUndefined();
    expect(system.experienceOf(standard)).toBeNull();
    expect(system.subtitle(standard)).toBe(system.label);
  });
});
