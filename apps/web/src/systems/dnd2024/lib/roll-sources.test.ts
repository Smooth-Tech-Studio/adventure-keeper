import { describe, expect, it } from "vitest";

import {
  autoRollSources,
  hasAdvantageChoice,
  type RollContext,
  type RollKind,
} from "./roll-sources";

describe("hasAdvantageChoice", () => {
  it("is offered on d20 tests", () => {
    for (const kind of ["carac", "attaque", "sauvegarde"] as RollKind[]) {
      expect(hasAdvantageChoice(kind)).toBe(true);
    }
  });

  it("is not offered on initiative", () => {
    expect(hasAdvantageChoice("initiative")).toBe(false);
  });

  it("is not offered on damage, which has no d20", () => {
    expect(hasAdvantageChoice("degats")).toBe(false);
  });
});

describe("autoRollSources — Warlock invocations", () => {
  const character: NonNullable<RollContext["character"]> = {
    classId: "warlock",
    level: 5,
    abilityModifiers: { str: 0, dex: 2, con: 2, int: 0, wis: 0, cha: 3 },
    eldritchInvocations: [
      { id: "agonizing-blast", spellId: "eldritch-blast" },
      { id: "pact-of-the-blade" },
      { id: "lifedrinker" },
      { id: "eldritch-mind" },
    ],
    pactWeaponId: "sword",
  };

  it("adds Charisma per beam to Décharge occulte's damage", () => {
    expect(
      autoRollSources("degats", undefined, {
        character,
        spellId: "eldritch-blast",
        spellDiceCount: 2,
      }),
    ).toEqual([{ label: "Décharge déchirante", flat: 6 }]);
  });

  it("adds 1d6 to the pact weapon's damage at level 9", () => {
    const at9 = { ...character, level: 9 };
    expect(autoRollSources("degats", undefined, { character: at9, weaponId: "sword" })).toEqual([
      { label: "Buveuse de vie", dice: { count: 1, die: "d6" } },
    ]);
    // Not yet: Buveuse de vie needs level 9.
    expect(autoRollSources("degats", undefined, { character, weaponId: "sword" })).toEqual([]);
  });

  it("hints advantage on a Constitution save only while concentrating", () => {
    const concentrating = { concentration: { label: "Malédiction" } } as never;
    expect(autoRollSources("sauvegarde", concentrating, { character, saveAbility: "con" })).toEqual(
      [{ label: "Esprit occulte", hint: "avantage (concentration)" }],
    );
    expect(autoRollSources("sauvegarde", undefined, { character, saveAbility: "con" })).toEqual([]);
  });

  it("does nothing for another class, or with no context", () => {
    expect(
      autoRollSources("degats", undefined, {
        character: { ...character, classId: "wizard" },
        spellId: "eldritch-blast",
      }),
    ).toEqual([]);
    expect(autoRollSources("degats")).toEqual([]);
  });

  it("still lists exhaustion alongside", () => {
    const exhausted = { exhaustion: 1 } as never;
    expect(autoRollSources("sauvegarde", exhausted, { character, saveAbility: "wis" })).toEqual([
      { label: "Épuisement (niv 1)", flat: -2 },
    ]);
  });
});

describe("fighting styles that change the dice", () => {
  const sheet = (featIds: string[]) => ({
    classId: "fighter" as const,
    level: 5,
    abilityModifiers: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    eldritchInvocations: [],
    featIds,
  });

  it("reminds on a damage roll, not on a d20 test", () => {
    const damage = autoRollSources("degats", undefined, {
      character: sheet(["great-weapon-fighting"]),
    });
    expect(damage.map((s) => s.label)).toContain("Arme à deux mains");
    // The reminder is a hint, never a number the calculator would add.
    expect(damage.find((s) => s.label === "Arme à deux mains")?.flat).toBeUndefined();

    const attack = autoRollSources("attaque", undefined, {
      character: sheet(["great-weapon-fighting"]),
    });
    expect(attack.map((s) => s.label)).not.toContain("Arme à deux mains");
  });

  it("covers the three dice-changing picks", () => {
    const all = autoRollSources("degats", undefined, {
      character: sheet(["great-weapon-fighting", "two-weapon-fighting", "savage-attacker"]),
    });
    expect(all).toHaveLength(3);
  });

  it("says nothing for a sheet with no feats, or one saved before they existed", () => {
    expect(autoRollSources("degats", undefined, { character: sheet([]) })).toEqual([]);
    const legacy = { ...sheet([]), featIds: undefined };
    expect(autoRollSources("degats", undefined, { character: legacy })).toEqual([]);
  });
});
