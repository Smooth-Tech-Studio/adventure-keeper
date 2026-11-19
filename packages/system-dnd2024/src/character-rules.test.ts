import { describe, expect, it } from "vitest";
import {
  computeCharacterDerived,
  hitPointGain,
  rollAt,
  unsettledHitPointLevels,
} from "./character-rules";
import { speciesHasSizeChoice, speciesSize, speciesSizes } from "./species";
import type { AbilityScoreBlock, AbilityBonusBlock } from "./abilities";
import type { WeaponProps } from "./weapons";
import { withContent } from "./packs/active";
import { EFFECTS, essai } from "./packs/fixtures/effects-pack";

const NO_BONUS: AbilityBonusBlock = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

/** Fighter L1, criminal background (Sleight of Hand + Stealth), STR/CON saves. */
function fighter(overrides?: Partial<Parameters<typeof computeCharacterDerived>[0]>) {
  const base: AbilityScoreBlock = { str: 16, dex: 14, con: 15, int: 8, wis: 12, cha: 10 };
  return computeCharacterDerived({
    classId: "fighter",
    level: 1,
    baseAbilityScores: base,
    backgroundAbilityBonuses: NO_BONUS,
    backgroundId: "criminal",
    skillProficiencies: ["athletics", "perception"],
    speciesSkillProficiencies: [],
    skillExpertise: [],
    ...overrides,
  });
}

describe("computeCharacterDerived", () => {
  it("adds the ability-score improvement, without passing 20", () => {
    const d = computeCharacterDerived({
      classId: "wizard",
      level: 4,
      baseAbilityScores: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
      backgroundAbilityBonuses: { str: 0, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
      backgroundId: "sage",
      choices: [
        { choiceId: "level:4:feat", values: ["ability-score-improvement"] },
        { choiceId: "level:4:asi", values: ["int", "con"] },
      ],
    });
    expect(d.adjustedAbilityScores.int).toBe(20);
    expect(d.adjustedAbilityScores.con).toBe(15);
  });

  it("adds a general feat's +1 to the ability picked, without passing 20", () => {
    const grappler = (str: number, ability?: string) =>
      fighter({
        level: 4,
        baseAbilityScores: { str, dex: 14, con: 15, int: 8, wis: 12, cha: 10 },
        choices: [
          { choiceId: "level:4:feat", values: ["grappler"] },
          ...(ability ? [{ choiceId: "feat:grappler:ability-increase", values: [ability] }] : []),
        ],
      }).adjustedAbilityScores;
    expect(grappler(16, "str").str).toBe(17);
    expect(grappler(20, "str").str).toBe(20);
    expect(grappler(16).str).toBe(16); // not picked yet
    expect(grappler(16, "wis").wis).toBe(12); // not one of the feat's options
  });

  it("lets an epic boon's +1 go up to 30", () => {
    const d = fighter({
      level: 19,
      baseAbilityScores: { str: 20, dex: 14, con: 15, int: 8, wis: 12, cha: 10 },
      choices: [
        { choiceId: "level:19:epic-boon", values: ["boon-of-truesight"] },
        { choiceId: "feat:boon-of-truesight:ability-increase", values: ["str"] },
      ],
    });
    expect(d.adjustedAbilityScores.str).toBe(21);
  });

  it("applies a pack feat's single-option +1 without a pick", () => {
    const d = withContent(EFFECTS, () =>
      fighter({ level: 4, choices: [{ choiceId: "level:4:feat", values: [essai("costaud")] }] }),
    );
    expect(d.adjustedAbilityScores.con).toBe(16);
  });

  it("counts the origin feat a Human picks with « Polyvalent »", () => {
    const d = withContent(EFFECTS, () =>
      fighter({
        speciesId: "human",
        choices: [{ choiceId: "species:human:origin-feat", values: [essai("robuste")] }],
      }),
    );
    expect(d.maxHitPoints).toBe(fighter().maxHitPoints + 2);
  });

  it("adds background bonuses to the score, then derives the modifier", () => {
    const d = computeCharacterDerived({
      classId: "wizard",
      level: 1,
      baseAbilityScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      backgroundAbilityBonuses: { str: 0, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
      backgroundId: "sage",
    });
    expect(d.adjustedAbilityScores.int).toBe(17);
    expect(d.abilityModifiers.int).toBe(3);
    expect(d.adjustedAbilityScores.con).toBe(14);
    expect(d.abilityModifiers.con).toBe(2);
  });

  it("computes max HP from hit die + CON per 2024 rules", () => {
    // Fighter d10, CON +2: L1 = 10 + 2 = 12.
    expect(fighter().maxHitPoints).toBe(12);
    // L3 = 12 + 2 * (6 + 2) = 28.
    expect(fighter({ level: 3 }).maxHitPoints).toBe(28);
  });

  it("adds the dwarf's « Ténacité naine »: +1 HP per level", () => {
    expect(fighter({ speciesId: "dwarf" }).maxHitPoints).toBe(13);
    expect(fighter({ speciesId: "dwarf", level: 3 }).maxHitPoints).toBe(31);
  });

  it("uses the kept hit-die rolls, the average elsewhere", () => {
    // Fighter d10, CON +2: L1 = 12; L3 with a 3 at level 2 and nothing at 3.
    const d = fighter({ level: 3, hitPointRolls: [{ level: 2, roll: 3 }] });
    expect(d.maxHitPoints).toBe(12 + (3 + 2) + (6 + 2));
    // A roll above the die counts as the die; one past the level is ignored.
    expect(
      fighter({
        level: 2,
        hitPointRolls: [
          { level: 2, roll: 15 },
          { level: 3, roll: 1 },
        ],
      }).maxHitPoints,
    ).toBe(12 + 10 + 2);
  });

  it("never lets a level take hit points away", () => {
    const frail = { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 };
    // CON 1 → −5: a 1 on the die would give −4, the rules give 1.
    const d = fighter({
      level: 2,
      baseAbilityScores: frail,
      hitPointRolls: [{ level: 2, roll: 1 }],
    });
    expect(d.maxHitPoints).toBe(Math.max(1, 10 - 5) + 1);
  });

  it("proficiency bonus follows level", () => {
    expect(fighter({ level: 1 }).proficiencyBonus).toBe(2);
    expect(fighter({ level: 5 }).proficiencyBonus).toBe(3);
    expect(fighter({ level: 17 }).proficiencyBonus).toBe(6);
  });

  it("unions class picks, background skills and species skills", () => {
    const d = fighter({ speciesSkillProficiencies: ["survival"] });
    expect(new Set(d.proficientSkills)).toEqual(
      new Set(["athletics", "perception", "sleightOfHand", "stealth", "survival"]),
    );
  });

  it("adds proficiency to proficient skills only", () => {
    const d = fighter(); // DEX +2, prof +2
    expect(d.skillModifiers.stealth).toBe(4); // background-proficient
    expect(d.skillModifiers.acrobatics).toBe(2); // not proficient
  });

  it("doubles proficiency for expertise skills", () => {
    const d = fighter({ skillExpertise: ["athletics"] }); // STR +3, prof +2
    expect(d.skillModifiers.athletics).toBe(3 + 2 + 2);
  });

  it("applies proficiency to class saving throws only", () => {
    const d = fighter(); // STR/CON saves for fighter, prof +2
    expect(d.savingThrowModifiers.str).toBe(3 + 2);
    expect(d.savingThrowModifiers.con).toBe(2 + 2);
    expect(d.savingThrowModifiers.dex).toBe(2);
  });

  it("passive perception is 10 + perception modifier", () => {
    const d = fighter(); // perception proficient: WIS +1 + prof +2 = +3
    expect(d.skillModifiers.perception).toBe(3);
    expect(d.passivePerception).toBe(13);
  });

  it("unarmoured armour class is 10 + Dex modifier", () => {
    expect(fighter().armorClass).toBe(12); // DEX 14 -> +2
    expect(
      fighter({ baseAbilityScores: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 } })
        .armorClass,
    ).toBe(14);
  });
});

const leather = {
  category: "light" as const,
  baseAc: 11,
  addsDex: true,
  stealthDisadvantage: false,
};
const halfPlate = {
  category: "medium" as const,
  baseAc: 15,
  addsDex: true,
  maxDex: 2,
  stealthDisadvantage: true,
};
const plate = {
  category: "heavy" as const,
  baseAc: 18,
  addsDex: false,
  strengthMin: 15,
  stealthDisadvantage: true,
};
const shield = {
  category: "shield" as const,
  acBonus: 2,
  addsDex: false,
  stealthDisadvantage: false,
};

describe("armour class", () => {
  it("light armour adds the full Dex modifier", () => {
    expect(
      fighter({ armors: [{ id: "a", name: "Cuir", armor: { ...leather, equipped: true } }] })
        .armorClass,
    ).toBe(13);
  });

  it("medium armour caps the Dex contribution at 2", () => {
    const d = fighter({
      baseAbilityScores: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
      armors: [{ id: "a", name: "Demi-plate", armor: { ...halfPlate, equipped: true } }],
    });
    expect(d.armorClass).toBe(17); // 15 + min(4, 2)
  });

  it("heavy armour ignores Dex; a shield adds its flat bonus", () => {
    const d = fighter({
      armors: [
        { id: "a", name: "Harnois", armor: { ...plate, equipped: true } },
        { id: "b", name: "Bouclier", armor: { ...shield, equipped: true } },
      ],
    });
    expect(d.armorClass).toBe(20);
  });

  it("ignores armour that is not equipped", () => {
    expect(
      fighter({ armors: [{ id: "a", name: "Harnois", armor: { ...plate, equipped: false } }] })
        .armorClass,
    ).toBe(12);
  });

  it("flags armour outside the class's training", () => {
    const wiz = computeCharacterDerived({
      classId: "wizard",
      level: 1,
      baseAbilityScores: { str: 10, dex: 12, con: 12, int: 15, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      armors: [{ id: "a", name: "Harnois", armor: { ...plate, equipped: true } }],
    });
    expect(wiz.armorProficient).toBe(false);
    expect(fighter().armorProficient).toBe(true);
  });

  it("an untrained shield adds nothing to the AC", () => {
    const wiz = computeCharacterDerived({
      classId: "wizard",
      level: 1,
      baseAbilityScores: { str: 10, dex: 12, con: 12, int: 15, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      armors: [{ id: "s", name: "Bouclier", armor: { ...shield, equipped: true } }],
    });
    expect(wiz.armorProficient).toBe(false);
    expect(wiz.armorClass).toBe(11);
  });

  it("flags the Stealth disadvantage of the worn armour", () => {
    expect(
      fighter({ armors: [{ id: "a", name: "Harnois", armor: { ...plate, equipped: true } }] })
        .stealthDisadvantage,
    ).toBe(plate.stealthDisadvantage);
    expect(fighter().stealthDisadvantage).toBe(false);
  });
});

describe("carrying capacity", () => {
  it("is Strength × 7.5 kg, one size up for a Goliath", () => {
    expect(fighter().carryingCapacityKg).toBe(120);
    expect(fighter({ speciesId: "goliath" }).carryingCapacityKg).toBe(240);
  });
});

describe("speed", () => {
  it("defaults to 30 ft and uses the species base when provided", () => {
    expect(fighter().speed).toBe(30);
    expect(fighter({ speciesId: "goliath" }).speed).toBe(35);
  });

  it("drops 10 ft under heavy armour with too little Strength", () => {
    const weak = fighter({
      baseAbilityScores: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      armors: [{ id: "a", name: "Harnois", armor: { ...plate, equipped: true } }],
    });
    expect(weak.speed).toBe(20);
    // STR 16 fighter meets the requirement.
    expect(
      fighter({ armors: [{ id: "a", name: "Harnois", armor: { ...plate, equipped: true } }] })
        .speed,
    ).toBe(30);
  });
});

const longsword = {
  category: "martial-melee" as const,
  damageDice: { count: 1, die: "d8" as const },
  damageType: "slashing" as const,
  properties: [],
  mastery: "sap" as const,
};
const shortbow = {
  category: "simple-ranged" as const,
  damageDice: { count: 1, die: "d6" as const },
  damageType: "piercing" as const,
  properties: ["ammunition" as const],
  mastery: "vex" as const,
};

describe("weapon attacks", () => {
  it("adds proficiency for a class that is trained with the weapon", () => {
    const [attack] = fighter({
      weapons: [{ id: "w", name: "Épée longue", weapon: longsword }],
    }).weaponAttacks;
    expect(attack).toMatchObject({ ability: "str", attackBonus: 5, damageBonus: 3 }); // STR +3, prof +2
  });

  it("omits proficiency when the class is not trained with the weapon", () => {
    const wiz = computeCharacterDerived({
      classId: "wizard",
      level: 1,
      baseAbilityScores: { str: 14, dex: 10, con: 12, int: 15, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      weapons: [{ id: "w", name: "Épée longue", weapon: longsword }],
    });
    expect(wiz.weaponAttacks[0]).toMatchObject({ proficient: false, attackBonus: 2 }); // STR +2 only
  });

  it("tolerates a pre-DicePool weapon block (string damageDice) without leaking 'undefined'", () => {
    const [attack] = fighter({
      weapons: [
        {
          id: "w",
          name: "Épée longue (fiche ancienne)",
          // legacy shape: damageDice stored as a string before the DicePool type
          weapon: {
            category: "martial-melee",
            damageDice: "1d8",
            damageType: "slashing",
            properties: [],
          } as never,
        },
      ],
    }).weaponAttacks;
    expect(attack.damageDice).toBe("1d8");
  });

  it("ranged weapons use Dexterity", () => {
    const [attack] = fighter({
      weapons: [{ id: "w", name: "Arc court", weapon: shortbow }],
    }).weaponAttacks;
    expect(attack.ability).toBe("dex");
    expect(attack.attackBonus).toBe(4); // DEX +2, prof +2
  });

  it("a focus never produces an attack line", () => {
    const wiz = computeCharacterDerived({
      classId: "wizard",
      level: 1,
      baseAbilityScores: { str: 10, dex: 12, con: 12, int: 15, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      weapons: [
        { id: "f", name: "Bâton (focaliseur)", weapon: { category: "focus", properties: [] } },
        { id: "d", name: "Dague", weapon: longsword },
      ],
    });
    expect(wiz.weaponAttacks.map((a) => a.itemId)).toEqual(["d"]);
  });

  it("mastery is active only when the weapon is assigned a slot", () => {
    const withoutSlot = fighter({
      weapons: [{ id: "w", name: "Épée longue", weapon: longsword }],
    }).weaponAttacks[0];
    expect(withoutSlot.masteryActive).toBe(false);

    const withSlot = fighter({
      weapons: [{ id: "w", name: "Épée longue", weapon: longsword }],
      weaponMasteries: ["w"],
    }).weaponAttacks[0];
    expect(withSlot).toMatchObject({ mastery: "sap", masteryActive: true });
  });

  it("a mastery names a kind of weapon: every one carried uses it", () => {
    const attacks = fighter({
      weapons: [
        { id: "a", catalogId: "longsword", name: "Épée longue", weapon: longsword },
        { id: "b", catalogId: "longsword", name: "Épée longue", weapon: longsword },
        { id: "c", catalogId: "flail", name: "Fléau", weapon: longsword },
      ],
      weaponMasteries: ["longsword"],
    }).weaponAttacks;
    expect(attacks.map((attack) => attack.masteryActive)).toEqual([true, true, false]);
  });

  it("mastery stays inactive for a class with no mastery slots", () => {
    const bard = computeCharacterDerived({
      classId: "bard",
      level: 1,
      baseAbilityScores: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 15 },
      backgroundAbilityBonuses: NO_BONUS,
      weapons: [
        { id: "w", name: "Épée longue", weapon: { ...longsword, category: "simple-melee" } },
      ],
      weaponMasteries: ["w"],
    });
    expect(bard.masterySlots).toBe(0);
    expect(bard.weaponAttacks[0].masteryActive).toBe(false);
  });

  it("barbarian mastery slots grow at levels 4 and 10", () => {
    const at = (level: number) =>
      computeCharacterDerived({
        classId: "barbarian",
        level,
        baseAbilityScores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
        backgroundAbilityBonuses: NO_BONUS,
      }).masterySlots;
    expect(at(1)).toBe(2);
    expect(at(3)).toBe(2);
    expect(at(4)).toBe(3);
    expect(at(9)).toBe(3);
    expect(at(10)).toBe(4);
  });
});

describe("combat notes & bonus actions on the derived block", () => {
  it("surfaces the class's combat notes", () => {
    const d = computeCharacterDerived({
      classId: "rogue",
      level: 5,
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
    });
    expect(d.combatNotes.join(" ")).toContain("Attaque sournoise : +3d6");
    expect(d.bonusActions.join(" ")).toContain("Ruse");
  });

  it("detects two-weapon fighting from two Light melee weapons carried", () => {
    const dagger = {
      category: "simple-melee" as const,
      damageDice: { count: 1, die: "d4" as const },
      damageType: "piercing" as const,
      properties: ["finesse" as const, "light" as const],
    };
    const d = fighter({
      weapons: [
        { id: "a", name: "Dague", weapon: dagger },
        { id: "b", name: "Dague", weapon: dagger },
      ],
    });
    expect(d.bonusActions).toContain("Attaquer avec une seconde arme légère (combat à deux armes)");
  });
});

describe("species attack — Drakéide breath weapon", () => {
  const dragonborn = (over?: Partial<Parameters<typeof computeCharacterDerived>[0]>) =>
    computeCharacterDerived({
      classId: "fighter",
      level: 1,
      // CON 14 (+2), so DC = 8 + prof + 2
      baseAbilityScores: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      speciesId: "dragonborn",
      speciesChoice: "Rouge",
      ...over,
    });

  it("is null for a species without one", () => {
    expect(fighter().speciesAttack).toBeNull();
  });

  it("Drakéide: Dex save, DC 8 + prof + Con, uses = proficiency bonus", () => {
    expect(dragonborn().speciesAttack).toMatchObject({
      name: "Souffle draconique",
      saveAbility: "dex",
      saveDc: 12, // 8 + 2 + 2
      onSuccess: "half",
      damageDice: "1d10",
      damageKind: "fire",
      usesPerLongRest: 2,
    });
    // L9: prof +4 → DC 8 + 4 + 2 = 14, and 4 uses per long rest
    expect(dragonborn({ level: 9 }).speciesAttack).toMatchObject({
      saveDc: 14,
      usesPerLongRest: 4,
    });
  });

  it("damage dice grow at levels 5 / 11 / 17", () => {
    expect(dragonborn({ level: 4 }).speciesAttack?.damageDice).toBe("1d10");
    expect(dragonborn({ level: 5 }).speciesAttack?.damageDice).toBe("2d10");
    expect(dragonborn({ level: 11 }).speciesAttack?.damageDice).toBe("3d10");
    expect(dragonborn({ level: 17 }).speciesAttack?.damageDice).toBe("4d10");
  });

  it("damage type follows the draconic ancestry", () => {
    expect(dragonborn({ speciesChoice: "Vert" }).speciesAttack?.damageKind).toBe("poison");
    expect(dragonborn({ speciesChoice: "Cuivre" }).speciesAttack?.damageKind).toBe("acid");
    expect(dragonborn({ speciesChoice: "Argent" }).speciesAttack?.damageKind).toBe("cold");
    expect(dragonborn({ speciesChoice: "Bronze" }).speciesAttack?.damageKind).toBe("lightning");
    // unknown / unset ancestry falls back to fire
    expect(dragonborn({ speciesChoice: undefined }).speciesAttack?.damageKind).toBe("fire");
  });
});

describe("unarmed strike & martial arts", () => {
  const monk = (over?: Partial<Parameters<typeof computeCharacterDerived>[0]>) =>
    computeCharacterDerived({
      classId: "monk",
      level: 1,
      // STR 14 (+2), DEX 16 (+3)
      baseAbilityScores: { str: 14, dex: 16, con: 13, int: 10, wis: 12, cha: 8 },
      backgroundAbilityBonuses: NO_BONUS,
      ...over,
    });

  it("every class has an unarmed strike: 1 + Str, always proficient", () => {
    const u = fighter().unarmedStrike; // STR 16 (+3), prof +2
    expect(u).toMatchObject({
      itemId: "unarmed-strike",
      ability: "str",
      attackBonus: 5,
      damageDice: "1",
      damageBonus: 3,
      damageType: "bludgeoning",
      proficient: true,
      unarmed: true,
    });
  });

  it("a Monk's unarmed strike uses Dexterity and the Martial Arts die", () => {
    const u = monk().unarmedStrike;
    expect(u).toMatchObject({ ability: "dex", attackBonus: 5, damageDice: "1d6", damageBonus: 3 });
  });

  it("flags Martial Arts only for an unarmoured, shieldless Monk", () => {
    expect(monk().martialArts).toBe(true);
    expect(fighter().martialArts).toBe(false);
    expect(
      monk({ armors: [{ id: "s", name: "Bouclier", armor: { ...shield, equipped: true } }] })
        .martialArts,
    ).toBe(false);
  });

  it("the Martial Arts die grows with level", () => {
    expect(monk({ level: 5 }).unarmedStrike.damageDice).toBe("1d8");
    expect(monk({ level: 11 }).unarmedStrike.damageDice).toBe("1d10");
    expect(monk({ level: 17 }).unarmedStrike.damageDice).toBe("1d12");
  });

  it("Martial Arts is suppressed while wearing armour", () => {
    const u = monk({
      armors: [{ id: "a", name: "Cuir", armor: { ...leather, equipped: true } }],
    }).unarmedStrike;
    expect(u).toMatchObject({ ability: "str", damageDice: "1" });
  });

  it("Martial Arts is suppressed by a shield too, even one the Monk is not trained with", () => {
    const u = monk({
      armors: [{ id: "s", name: "Bouclier", armor: { ...shield, equipped: true } }],
    }).unarmedStrike;
    expect(u).toMatchObject({ ability: "str", damageDice: "1" });
  });

  it("a Monk weapon gets Dex + the Martial Arts die (bigger of the two)", () => {
    const [staff] = monk({
      weapons: [
        {
          id: "w",
          name: "Bâton de combat",
          weapon: {
            category: "simple-melee",
            damageDice: { count: 1, die: "d6" },
            damageType: "bludgeoning",
            properties: ["versatile"],
          },
        },
      ],
    }).weaponAttacks;
    // d6 staff, d6 MA die at L1 → still d6, but Dex (+3) instead of Str (+2)
    expect(staff).toMatchObject({ ability: "dex", damageBonus: 3, damageDice: "1d6" });
  });

  it("a non-Monk weapon is untouched by Martial Arts", () => {
    const [gs] = monk({
      weapons: [
        {
          id: "w",
          name: "Épée à deux mains",
          weapon: {
            category: "martial-melee",
            damageDice: { count: 2, die: "d6" },
            damageType: "slashing",
            properties: ["two-handed", "heavy"],
          },
        },
      ],
    }).weaponAttacks;
    expect(gs).toMatchObject({ ability: "str", damageDice: "2d6" });
  });
});

describe("granted spells", () => {
  it("surfaces the Druid's always-prepared spell on the derived block", () => {
    const druid = computeCharacterDerived({
      classId: "druid",
      level: 1,
      baseAbilityScores: { str: 8, dex: 13, con: 14, int: 12, wis: 15, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
    });
    expect(druid.grantedSpells.map((g) => g.spellId)).toEqual(["speak-with-animals"]);
  });

  it("is empty for a class with no such feature", () => {
    expect(fighter().grantedSpells).toEqual([]);
  });
});

describe("tool checks", () => {
  const thievesTools = {
    id: "t",
    name: "Outils de voleur",
    catalogId: "thieves-tools",
    tool: { category: "thieves" as const, ability: "dex" as const },
  };

  it("adds the proficiency bonus when the tool is proficient", () => {
    const d = fighter({ tools: [thievesTools], toolProficiencies: ["thieves-tools"] });
    expect(d.toolCheckModifiers["thieves-tools"]).toBe(4); // DEX +2 + prof +2
  });

  it("doubles the proficiency bonus for expertise", () => {
    const d = fighter({
      tools: [thievesTools],
      toolProficiencies: ["thieves-tools"],
      toolExpertise: ["thieves-tools"],
    });
    expect(d.toolCheckModifiers["thieves-tools"]).toBe(6); // DEX +2 + 2*prof
  });

  it("no bonus without proficiency (criminal background already grants thieves' tools)", () => {
    // Criminal background grants thieves' tools, so the fighter *is* proficient there.
    expect(fighter({ tools: [thievesTools] }).toolCheckModifiers["thieves-tools"]).toBe(4);

    // A tool nobody granted: ability modifier only (INT 8 -> -1).
    const d = fighter({
      tools: [
        {
          id: "s",
          name: "Matériel d'alchimiste",
          catalogId: "alchemist-supplies",
          tool: { category: "artisan", ability: "int" },
        },
      ],
    });
    expect(d.toolCheckModifiers["alchemist-supplies"]).toBe(-1);
  });

  it("grants the fixed tool proficiency a class provides", () => {
    const rogue = computeCharacterDerived({
      classId: "rogue",
      level: 1,
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      tools: [thievesTools],
    });
    expect(rogue.toolCheckModifiers["thieves-tools"]).toBe(5); // DEX +3 + prof +2
  });

  it("lists every proficiency, carried or not", () => {
    // Being trained has nothing to do with owning the tool: the fighter below
    // carries none, yet the criminal background still trained them.
    expect(fighter().toolProficiencies).toEqual(["thieves-tools"]);

    const rogue = computeCharacterDerived({
      classId: "rogue",
      level: 1,
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      backgroundId: "acolyte",
      toolProficiencies: ["lute"],
    });
    // Class (thieves' tools) + background (calligrapher) + the player's pick,
    // de-duplicated and sorted.
    expect(rogue.toolProficiencies).toEqual(["calligrapher-supplies", "lute", "thieves-tools"]);
  });
});

describe("size", () => {
  const sized = (speciesId: string, size?: string) => fighter({ speciesId, size }).size;

  it("is fixed by a species that has a single size", () => {
    expect(sized("halfling")).toBe("small");
    expect(sized("gnome")).toBe("small");
    expect(sized("dwarf")).toBe("medium");
    expect(sized("elf")).toBe("medium");
  });

  it("lets Humain and Tieffelin pick Small or Medium, Medium by default", () => {
    for (const speciesId of ["human", "tiefling"]) {
      expect(speciesHasSizeChoice(speciesId)).toBe(true);
      expect(sized(speciesId)).toBe("medium");
      expect(sized(speciesId, "small")).toBe("small");
      expect(sized(speciesId, "medium")).toBe("medium");
    }
  });

  it("ignores a size the species does not allow", () => {
    expect(sized("human", "large")).toBe("medium");
    expect(sized("halfling", "medium")).toBe("small");
    expect(sized("dwarf", "small")).toBe("medium");
  });

  it("falls back to Medium without a known species", () => {
    expect(fighter().size).toBe("medium");
    expect(speciesSize("nope")).toBeUndefined();
  });

  it("lists the sizes each species allows", () => {
    expect(speciesSizes("human")).toEqual(["small", "medium"]);
    expect(speciesSizes("halfling")).toEqual(["small"]);
    expect(speciesSizes("nope")).toEqual([]);
  });
});

describe("species lineage / legacy effects", () => {
  const elf = (speciesChoice?: string, overrides?: Parameters<typeof fighter>[0]) =>
    fighter({ speciesId: "elf", speciesChoice, ...overrides });
  const tiefling = (speciesChoice?: string, overrides?: Parameters<typeof fighter>[0]) =>
    fighter({ speciesId: "tiefling", speciesChoice, ...overrides });

  it("Drow sees 120 ft in the dark, other elves 60 ft", () => {
    expect(elf("Drow").darkvision).toBe(120);
    expect(elf("Haut-elfe").darkvision).toBe(60);
    expect(elf().darkvision).toBe(60);
  });

  it("Wood elves walk at 35 ft, the other lineages at 30 ft", () => {
    expect(elf("Elfe des bois").speed).toBe(35);
    expect(elf("Drow").speed).toBe(30);
    expect(elf().speed).toBe(30);
  });

  it("puts the lineage spells on the derived block, by level", () => {
    expect(elf("Drow", { level: 1 }).grantedSpells.map((g) => g.spellId)).toEqual([
      "dancing-lights",
    ]);
    expect(elf("Drow", { level: 3 }).grantedSpells.map((g) => g.spellId)).toEqual([
      "dancing-lights",
      "faerie-fire",
    ]);
  });

  it("gives a Tieffelin the resistance of the chosen legacy", () => {
    expect(tiefling("Abyssal").resistances).toEqual(["poison"]);
    expect(tiefling("Chthonien").resistances).toEqual(["necrotic"]);
    expect(tiefling("Infernal").resistances).toEqual(["fire"]);
    expect(tiefling().resistances).toEqual([]);
  });

  it("keeps the fixed resistances of other species", () => {
    expect(fighter({ speciesId: "dwarf" }).resistances).toEqual(["poison"]);
    expect(fighter({ speciesId: "dragonborn", speciesChoice: "Rouge" }).resistances).toEqual([
      "fire",
    ]);
    expect(fighter({ speciesId: "human" }).resistances).toEqual([]);
  });

  it("casts species spells with the ability the player picked", () => {
    // Fighter with INT 8, WIS 12, CHA 10 at level 1 (proficiency +2).
    expect(elf("Drow", { speciesSpellAbility: "wis" }).speciesSpellcasting).toEqual({
      ability: "wis",
      saveDc: 8 + 2 + 1,
      attackBonus: 2 + 1,
    });
    // Unset (or invalid) → Charisma for a non-caster class.
    expect(elf("Drow").speciesSpellcasting?.ability).toBe("cha");
    expect(elf("Drow", { speciesSpellAbility: "str" }).speciesSpellcasting?.ability).toBe("cha");
  });

  it("has no species spellcasting for a species without spells", () => {
    expect(fighter({ speciesId: "human" }).speciesSpellcasting).toBeNull();
    expect(fighter().speciesSpellcasting).toBeNull();
  });
});

describe("Warlock invocations", () => {
  const warlock = (
    eldritchInvocations: Parameters<typeof computeCharacterDerived>[0]["eldritchInvocations"],
    overrides?: Partial<Parameters<typeof computeCharacterDerived>[0]>,
  ) =>
    computeCharacterDerived({
      classId: "warlock",
      level: 5,
      baseAbilityScores: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      backgroundAbilityBonuses: NO_BONUS,
      backgroundId: "criminal",
      eldritchInvocations,
      ...overrides,
    });
  const longsword = {
    id: "sword",
    name: "Épée longue",
    weapon: {
      category: "martial-melee" as const,
      damageDice: { count: 1, die: "d8" as const },
      damageType: "slashing" as const,
      properties: ["versatile" as const],
    },
  };

  it("Armure d'ombres sets AC to 13 + Dex without armour", () => {
    expect(warlock([]).armorClass).toBe(12); // 10 + Dex 2
    expect(warlock(["armor-of-shadows"]).armorClass).toBe(15); // 13 + Dex 2
  });

  it("Armure d'ombres does not stack with worn armour", () => {
    const chain = {
      id: "chain",
      name: "Cotte de mailles",
      armor: {
        category: "heavy" as const,
        baseAc: 16,
        addsDex: false,
        stealthDisadvantage: true,
        equipped: true,
      },
    };
    expect(warlock(["armor-of-shadows"], { armors: [chain] }).armorClass).toBe(16);
  });

  it("Vision du diable / Vision sorcière / Présent des profondeurs set the senses", () => {
    const d = warlock(["devils-sight", "gift-of-the-depths"], { level: 5 });
    expect(d.darkvision).toBe(120);
    expect(d.swimSpeed).toBe(d.speed);
    expect(warlock([], { level: 15 }).darkvision).toBe(0);
    expect(warlock(["witch-sight"], { level: 15 }).truesight).toBe(30);
  });

  it("keeps the better darkvision between species and invocation", () => {
    expect(warlock(["devils-sight"], { speciesId: "orc" }).darkvision).toBe(120);
    expect(warlock(["devils-sight"], { speciesId: "elf", speciesChoice: "Drow" }).darkvision).toBe(
      120,
    );
  });

  it("lists at-will spells granted by invocations", () => {
    const granted = warlock(["mask-of-many-faces", "pact-of-the-chain"], {
      level: 5,
    }).grantedSpells;
    expect(granted.map((g) => g.spellId).sort()).toEqual(["disguise-self", "find-familiar"]);
    expect(granted.every((g) => g.source === "invocation" && !g.countsAgainstPrepared)).toBe(true);
  });

  it("the pact weapon attacks with Charisma and is always proficient", () => {
    const d = warlock(["pact-of-the-blade"], { weapons: [longsword], pactWeaponId: "sword" });
    const attack = d.weaponAttacks[0];
    expect(attack).toMatchObject({ ability: "cha", proficient: true, pact: true });
    // Cha 16 → +3, proficiency +3 at level 5.
    expect(attack.attackBonus).toBe(6);
    expect(attack.damageBonus).toBe(3);
  });

  it("does not use Charisma on other weapons, nor without Pacte de la lame", () => {
    const dagger = { ...longsword, id: "dagger", name: "Dague" };
    const withPact = warlock(["pact-of-the-blade"], {
      weapons: [longsword, dagger],
      pactWeaponId: "sword",
    });
    expect(withPact.weaponAttacks.find((a) => a.itemId === "dagger")?.ability).toBe("str");
    const noPact = warlock([], { weapons: [longsword], pactWeaponId: "sword" });
    expect(noPact.weaponAttacks[0]).toMatchObject({ ability: "str" });
    expect(noPact.weaponAttacks[0].pact).toBeUndefined();
  });

  it("ignores a ranged weapon as pact weapon", () => {
    const bow = {
      id: "bow",
      name: "Arc court",
      weapon: {
        category: "simple-ranged" as const,
        damageDice: { count: 1, die: "d6" as const },
        damageType: "piercing" as const,
        properties: ["ammunition" as const],
      },
    };
    const d = warlock(["pact-of-the-blade"], { weapons: [bow], pactWeaponId: "bow" });
    expect(d.weaponAttacks[0].pact).toBeUndefined();
  });

  it("adds combat reminders", () => {
    const d = warlock(["pact-of-the-blade", "thirsting-blade", "eldritch-mind"]);
    expect(d.combatNotes.join(" ")).toContain("attaquez 2 fois");
    expect(d.combatNotes.join(" ")).toContain("Esprit occulte");
  });

  it("is ignored by every other class", () => {
    const d = computeCharacterDerived({
      classId: "wizard",
      level: 5,
      baseAbilityScores: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
      backgroundAbilityBonuses: NO_BONUS,
      eldritchInvocations: ["armor-of-shadows", "devils-sight"],
    });
    expect(d.armorClass).toBe(12);
    expect(d.darkvision).toBe(0);
    expect(d.grantedSpells).toEqual([]);
  });
});

describe("choices folded into the derived block", () => {
  it("reads the subclass back from the picks", () => {
    expect(fighter({ level: 3 }).subclassId).toBeNull();
    const withSubclass = fighter({
      level: 3,
      choices: [{ choiceId: "class:fighter:subclass", values: ["fighter:champion"] }],
    });
    expect(withSubclass.subclassId).toBe("fighter:champion");
  });

  it("lists the feats held, origin feat included", () => {
    // Criminel grants Vigilant.
    expect(fighter().featIds).toEqual(["alert"]);
    const withStyle = fighter({
      choices: [{ choiceId: "class:fighter:fighting-style", values: ["archery"] }],
    });
    expect(withStyle.featIds).toEqual(["alert", "archery"]);
  });

  it("lists what the numbers already include, and keeps it out of the reminders", () => {
    const d = fighter({
      armors: [{ id: "a", name: "Cuir", armor: { ...leather, equipped: true } }],
      choices: [{ choiceId: "class:fighter:fighting-style", values: ["archery"] }],
    });
    const on = (target: string) =>
      d.includedEffects.filter((effect) => effect.on === target).map((effect) => effect.text);
    // Criminel grants Vigilant: the proficiency bonus is in the initiative.
    expect(on("initiative")).toEqual([expect.stringMatching(/^Vigilant \+2$/)]);
    expect(on("attacks")).toEqual([expect.stringContaining("Archerie")]);
    expect(d.combatNotes.join(" ")).not.toMatch(/Vigilant|Archerie/);
  });

  it("traces Défense on the armour class, only while armoured", () => {
    const style = [{ choiceId: "class:fighter:fighting-style", values: ["defense"] }];
    const armoured = fighter({
      armors: [{ id: "a", name: "Cuir", armor: { ...leather, equipped: true } }],
      choices: style,
    });
    expect(armoured.includedEffects).toContainEqual({ on: "armorClass", text: "Défense +1" });
    expect(fighter({ choices: style }).includedEffects.some((e) => e.on === "armorClass")).toBe(
      false,
    );
  });

  it("picks up a feat taken at a level slot", () => {
    withContent(EFFECTS, () => {
      const d = fighter({
        level: 4,
        choices: [{ choiceId: "level:4:feat", values: [essai("robuste")] }],
      });
      expect(d.featIds).toContain(essai("robuste"));
    });
  });

  it("applies Robuste to max hit points", () => {
    withContent(EFFECTS, () => {
      // Fighter d10, CON +2: L4 = 12 + 3 * 8 = 36; Robuste adds 2 per level.
      const plain = fighter({ level: 4 });
      const tough = fighter({
        level: 4,
        choices: [{ choiceId: "level:4:feat", values: [essai("robuste")] }],
      });
      expect(tough.maxHitPoints).toBe(plain.maxHitPoints + 8);
    });
  });

  it("applies Défense only when body armour is worn", () => {
    const chainMail = [
      {
        id: "armor-1",
        name: "Cotte de mailles",
        armor: {
          category: "heavy" as const,
          baseAc: 16,
          addsDex: false,
          stealthDisadvantage: true,
          equipped: true,
        },
      },
    ];
    const style = [{ choiceId: "class:fighter:fighting-style", values: ["defense"] }];

    const armoured = fighter({ armors: chainMail });
    const armouredWithStyle = fighter({ armors: chainMail, choices: style });
    expect(armouredWithStyle.armorClass).toBe(armoured.armorClass + 1);

    // Unarmoured: the style gives nothing.
    expect(fighter({ choices: style }).armorClass).toBe(fighter().armorClass);
  });

  it("applies Archerie to the attack bonus of ranged weapons only", () => {
    const style = [{ choiceId: "class:fighter:fighting-style", values: ["archery"] }];
    const bow = [{ id: "w", name: "Arc court", weapon: shortbow }];
    const sword = [{ id: "w", name: "Épée longue", weapon: longsword }];

    expect(fighter({ weapons: bow, choices: style }).weaponAttacks[0].attackBonus).toBe(
      fighter({ weapons: bow }).weaponAttacks[0].attackBonus + 2,
    );
    expect(fighter({ weapons: sword, choices: style }).weaponAttacks[0].attackBonus).toBe(
      fighter({ weapons: sword }).weaponAttacks[0].attackBonus,
    );
  });

  it("applies Duel to a one-handed melee weapon, never to a two-handed or ranged one", () => {
    withContent(EFFECTS, () => {
      const style = [{ choiceId: "class:fighter:fighting-style", values: [essai("duel")] }];
      const greatsword: WeaponProps = { ...longsword, properties: ["two-handed"] };
      const damageWith = (weapon: WeaponProps, choices?: typeof style) =>
        fighter({ weapons: [{ id: "w", name: "Arme", weapon }], ...(choices ? { choices } : {}) })
          .weaponAttacks[0].damageBonus;

      expect(damageWith(longsword, style)).toBe(damageWith(longsword) + 2);
      expect(damageWith(greatsword, style)).toBe(damageWith(greatsword));
      expect(damageWith(shortbow, style)).toBe(damageWith(shortbow));
    });
  });

  it("applies Armes de lancer to a weapon with the Thrown property", () => {
    withContent(EFFECTS, () => {
      const style = [{ choiceId: "class:fighter:fighting-style", values: [essai("lancer")] }];
      const javelin: WeaponProps = { ...longsword, properties: ["thrown"] };
      const damageWith = (weapon: WeaponProps, choices?: typeof style) =>
        fighter({ weapons: [{ id: "w", name: "Arme", weapon }], ...(choices ? { choices } : {}) })
          .weaponAttacks[0].damageBonus;

      expect(damageWith(javelin, style)).toBe(damageWith(javelin) + 2);
      expect(damageWith(longsword, style)).toBe(damageWith(longsword));
    });
  });

  it("does not stack Duel and Armes de lancer on a Thrown melee weapon", () => {
    withContent(EFFECTS, () => {
      // A javelin is melee *and* Thrown, so both styles match its line — but Duel
      // applies to the thrust and Armes de lancer to the throw, never together.
      const both = [
        { choiceId: "class:fighter:fighting-style", values: [essai("duel")] },
        { choiceId: "level:7:feat", values: [essai("lancer")] },
      ];
      const javelin: WeaponProps = { ...longsword, properties: ["thrown"] };
      const weapons = [{ id: "w", name: "Javeline", weapon: javelin }];

      const plain = fighter({ level: 7, weapons }).weaponAttacks[0].damageBonus;
      expect(fighter({ level: 7, weapons, choices: both }).weaponAttacks[0].damageBonus).toBe(
        plain + 2,
      );
    });
  });

  it("leaves the block unchanged when no choice is recorded — legacy sheets", () => {
    const d = fighter();
    expect(d.subclassId).toBeNull();
    expect(d.maxHitPoints).toBe(12);
  });
});

describe("feat combat notes", () => {
  it("adds a reminder for a feat whose effect is not a number", () => {
    const plain = fighter();
    const savage = fighter({
      level: 4,
      choices: [{ choiceId: "level:4:feat", values: ["savage-attacker"] }],
    });
    expect(savage.combatNotes.length).toBe(plain.combatNotes.length + 1);
    expect(savage.combatNotes.some((note) => note.includes("Sauvagerie martiale"))).toBe(true);
  });

  it("adds nothing for a feat the engine already folded into a number", () => {
    withContent(EFFECTS, () => {
      const plain = fighter({ level: 4 });
      const tough = fighter({
        level: 4,
        choices: [{ choiceId: "level:4:feat", values: [essai("robuste")] }],
      });
      expect(tough.combatNotes).toEqual(plain.combatNotes);
    });
  });
});

describe("feat effects on attacks", () => {
  it("Bagarreur de tavernes turns the Unarmed Strike into a d4", () => {
    withContent(EFFECTS, () => {
      expect(fighter().unarmedStrike.damageDice).toBe("1");
      const brawler = fighter({
        level: 4,
        choices: [{ choiceId: "level:4:feat", values: [essai("bagarreur")] }],
      });
      expect(brawler.unarmedStrike.damageDice).toBe("1d4");
    });
  });

  it("Maître des armes lourdes adds the proficiency bonus to Heavy weapons only", () => {
    withContent(EFFECTS, () => {
      const greatsword = [
        {
          id: "w1",
          name: "Épée à deux mains",
          weapon: {
            category: "martial-melee" as const,
            damageDice: { count: 2, die: "d6" as const },
            damageType: "slashing" as const,
            properties: ["heavy" as const, "two-handed" as const],
          },
        },
        {
          id: "w2",
          name: "Épée courte",
          weapon: {
            category: "martial-melee" as const,
            damageDice: { count: 1, die: "d6" as const },
            damageType: "piercing" as const,
            properties: ["light" as const, "finesse" as const],
          },
        },
      ];
      const plain = fighter({ level: 4, weapons: greatsword });
      const gwm = fighter({
        level: 4,
        weapons: greatsword,
        choices: [{ choiceId: "level:4:feat", values: [essai("armes-lourdes")] }],
      });

      const heavy = (d: typeof plain) => d.weaponAttacks.find((a) => a.itemId === "w1")!;
      const light = (d: typeof plain) => d.weaponAttacks.find((a) => a.itemId === "w2")!;
      expect(gwm.weaponAttacks).toHaveLength(2);
      expect(heavy(gwm).damageBonus).toBe(heavy(plain).damageBonus + gwm.proficiencyBonus);
      expect(light(gwm).damageBonus).toBe(light(plain).damageBonus);
    });
  });

  it("Maître d'hast adds a bonus action", () => {
    withContent(EFFECTS, () => {
      const plain = fighter({ level: 4 });
      const polearm = fighter({
        level: 4,
        choices: [{ choiceId: "level:4:feat", values: [essai("hast")] }],
      });
      expect(polearm.bonusActions.length).toBe(plain.bonusActions.length + 1);
      expect(polearm.bonusActions.some((action) => action.includes("Frappe double d'essai"))).toBe(
        true,
      );
    });
  });
});

describe("hit points per level", () => {
  it("an average recorded as such gains the average, like a level left blank", () => {
    expect(unsettledHitPointLevels([{ level: 2, method: "average" }], 4)).toEqual([3, 4]);
    expect(rollAt([{ level: 2, method: "average" }], 2)).toBeUndefined();
    expect(hitPointGain(10, 2, rollAt([{ level: 2, roll: 9, method: "roll" }], 2))).toBe(11);
  });
});
