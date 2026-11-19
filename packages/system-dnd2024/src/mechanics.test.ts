import { describe, expect, it } from "vitest";
import type { AbilityBonusBlock, AbilityScoreBlock } from "./abilities";
import { computeCharacterDerived, type ComputeCharacterInput } from "./character-rules";
import { classOptionChoiceDefs, getClassOption } from "./class-options";
import { limitedUsesMax, resolveAmount } from "./mechanics";
import { resolveChoices } from "./resolve-choices";
import { withContent } from "./packs/active";
import { parseContentPack } from "./packs/parse";
import { createContentOverlay } from "./packs/registry";

const NO_BONUS: AbilityBonusBlock = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const SCORES: AbilityScoreBlock = { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 12 };

function derive(classId: string, level: number, extra: Partial<ComputeCharacterInput> = {}) {
  return computeCharacterDerived({
    classId,
    level,
    baseAbilityScores: SCORES,
    backgroundAbilityBonuses: NO_BONUS,
    ...extra,
  });
}

const wear = (category: "light" | "medium" | "heavy" | "shield") => ({
  id: category,
  name: category,
  armor: {
    category,
    baseAc: category === "shield" ? undefined : { light: 11, medium: 14, heavy: 18 }[category],
    acBonus: category === "shield" ? 2 : undefined,
    addsDex: category === "light" || category === "medium",
    stealthDisadvantage: false,
    maxDex: category === "medium" ? 2 : undefined,
    equipped: true,
  },
});

describe("amounts", () => {
  const ctx = {
    level: 7,
    proficiencyBonus: 3,
    abilityModifiers: { str: 0, dex: 3, con: 2, int: 0, wis: -1, cha: 1 },
  };
  it("reads the proficiency, the level, a modifier with its floor, a table", () => {
    expect(resolveAmount("prof", ctx)).toBe(3);
    expect(resolveAmount("halfProf", ctx)).toBe(1);
    expect(resolveAmount("level", ctx)).toBe(7);
    expect(resolveAmount({ perLevel: 5 }, ctx)).toBe(35);
    expect(resolveAmount({ ability: "wis", min: 1 }, ctx)).toBe(1);
    expect(
      resolveAmount(
        {
          byLevel: [
            [2, 10],
            [6, 15],
            [10, 20],
          ],
        },
        ctx,
      ),
    ).toBe(15);
    expect(limitedUsesMax({ max: "prof" }, ctx)).toBe(3);
    expect(limitedUsesMax({ max: { ability: "wis" } }, ctx)).toBe(1);
  });
});

describe("Défense sans armure et déplacement", () => {
  it("gives the monk 10 + Dex + Wis and more speed, lost with a shield", () => {
    const monk = derive("monk", 6);
    expect(monk.armorClass).toBe(10 + 3 + 2);
    expect(monk.speed).toBe(30 + 15);
    const shielded = derive("monk", 6, { armors: [wear("shield")] });
    expect(shielded.speed).toBe(30);
    // The shield counts, but Wisdom no longer does.
    expect(shielded.armorClass).toBe(10 + 3 + 2);
  });

  it("gives the barbarian 10 + Dex + Con with a shield, and Fast Movement without heavy armour", () => {
    expect(derive("barbarian", 1).armorClass).toBe(10 + 3 + 2);
    expect(derive("barbarian", 1, { armors: [wear("shield")] }).armorClass).toBe(17);
    expect(derive("barbarian", 5).speed).toBe(40);
    expect(derive("barbarian", 5, { armors: [wear("medium")] }).speed).toBe(40);
    expect(derive("barbarian", 5, { armors: [wear("heavy")] }).speed).toBe(30);
  });

  it("gives the ranger climbing and swimming at walking speed", () => {
    const ranger = derive("ranger", 6);
    expect(ranger.speed).toBe(40);
    expect(ranger.climbSpeed).toBe(40);
    expect(ranger.swimSpeed).toBe(40);
  });
});

describe("initiative, jets de sauvegarde, tests", () => {
  it("adds the proficiency bonus to initiative with Vigilant", () => {
    expect(derive("fighter", 1).initiativeBonus).toBe(3);
    // The criminal's origin feat is Vigilant.
    const alert = derive("fighter", 1, { backgroundId: "criminal" });
    expect(alert.featIds).toContain("alert");
    expect(alert.initiativeBonus).toBe(3 + 2);
  });

  it("adds half the proficiency bonus to the bard's untrained checks, initiative included", () => {
    const bard = derive("bard", 2, { skillProficiencies: ["performance"] });
    expect(bard.skillModifiers.performance).toBe(1 + 2);
    expect(bard.skillModifiers.stealth).toBe(3 + 1);
    expect(bard.initiativeBonus).toBe(3 + 1);
  });

  it("gives the rogue Wisdom and Charisma saves at 15, the monk every save at 14", () => {
    expect(derive("rogue", 15).proficientSaves).toEqual(["dex", "int", "wis", "cha"]);
    const monk = derive("monk", 14);
    expect(monk.proficientSaves).toHaveLength(6);
    expect(monk.savingThrowModifiers.cha).toBe(1 + 5);
  });

  it("adds the paladin's aura to every save from level 6", () => {
    expect(derive("paladin", 5).savingThrowModifiers.dex).toBe(3);
    expect(derive("paladin", 6).savingThrowModifiers.dex).toBe(3 + 1);
  });

  it("marks advantages: on initiative (raw), on saves against a condition (reminder)", () => {
    const barbarian = derive("barbarian", 7);
    expect(barbarian.initiativeAdvantage).toBe(true);
    expect(barbarian.advantages).toContainEqual(
      expect.objectContaining({ on: "save", abilities: ["dex"] }),
    );
    const elf = derive("wizard", 1, { speciesId: "elf" });
    expect(elf.advantages[0]).toMatchObject({ on: "save", condition: expect.any(String) });
  });
});

describe("sous-classes, scores, PV", () => {
  it("lowers the champion's critical range", () => {
    const pick = [{ choiceId: "class:fighter:subclass", values: ["fighter:champion"] }];
    expect(derive("fighter", 2).critRange).toBe(20);
    expect(derive("fighter", 3, { choices: pick }).critRange).toBe(19);
    expect(derive("fighter", 15, { choices: pick }).critRange).toBe(18);
  });

  it("raises the barbarian's Strength and Constitution at 20, up to 25", () => {
    const d = derive("barbarian", 20, {
      baseAbilityScores: { ...SCORES, str: 20, con: 18 },
    });
    expect(d.adjustedAbilityScores.str).toBe(24);
    expect(d.adjustedAbilityScores.con).toBe(22);
  });

  it("gives the draconic sorcerer hit points and 10 + Dex + Cha", () => {
    const pick = [
      { choiceId: "class:sorcerer:subclass", values: ["sorcerer:sorcellerie-draconique"] },
    ];
    const base = derive("sorcerer", 3);
    const dragon = derive("sorcerer", 3, { choices: pick });
    expect(dragon.maxHitPoints).toBe(base.maxHitPoints + 3);
    expect(dragon.armorClass).toBe(10 + 3 + 1);
  });
});

describe("les choix qui n'étaient pas proposés", () => {
  it("leaves medium armour to the Warden druid only", () => {
    const medium = { armors: [wear("medium")] };
    expect(derive("druid", 1, medium).armorProficient).toBe(false);
    const warden = derive("druid", 1, {
      ...medium,
      choices: [{ choiceId: "class:druid:primal-order", values: ["primal-order-warden"] }],
    });
    expect(warden.armorProficient).toBe(true);
  });

  it("gives the Magician a cantrip and Wisdom to Arcana and Nature", () => {
    const magician = derive("druid", 1, {
      choices: [{ choiceId: "class:druid:primal-order", values: ["primal-order-magician"] }],
    });
    expect(magician.bonusCantrips).toBe(1);
    expect(magician.skillModifiers.nature).toBe(0 + 2);
    expect(magician.skillModifiers.history).toBe(0);
  });

  it("gives the Protector cleric heavy armour and martial weapons", () => {
    const protector = derive("cleric", 1, {
      armors: [wear("heavy")],
      choices: [{ choiceId: "class:cleric:divine-order", values: ["divine-order-protector"] }],
    });
    expect(protector.armorProficient).toBe(true);
  });

  it("offers the orders at level 1, the level-7 choices at 7, Primal Knowledge at 3", () => {
    const ids = (classId: string, level: number) =>
      resolveChoices({ classId, level }).map((def) => def.id);
    expect(ids("druid", 1)).toContain("class:druid:primal-order");
    expect(ids("druid", 6)).not.toContain("class:druid:elemental-fury");
    expect(ids("druid", 7)).toContain("class:druid:elemental-fury");
    expect(ids("cleric", 1)).toContain("class:cleric:divine-order");
    expect(ids("barbarian", 2)).not.toContain("class:barbarian:primal-knowledge");
    expect(ids("barbarian", 3)).toContain("class:barbarian:primal-knowledge");
    for (const def of classOptionChoiceDefs("cleric")) {
      if (def.pool.kind !== "list") throw new Error("list pool expected");
      for (const value of def.pool.values) expect(getClassOption(value)).toBeDefined();
    }
  });

  it("counts the Primal Knowledge skill as proficient", () => {
    const d = derive("barbarian", 3, {
      choices: [{ choiceId: "class:barbarian:primal-knowledge", values: ["survival"] }],
    });
    expect(d.proficientSkills).toContain("survival");
  });
});

describe("un pack paramètre les effets", () => {
  const result = parseContentPack({
    format: "ak-pack/1",
    system: "dnd2024",
    id: "meca",
    name: "Mécaniques d'essai",
    content: {
      feats: [
        {
          id: "eclaireur",
          name: "Éclaireur d'essai",
          category: "origin",
          summary: "+2 à l'initiative et 3 m de vitesse, pour les tests.",
          mechanics: [
            { type: "initiative", bonus: 2 },
            { type: "speed", bonus: 10 },
          ],
        },
      ],
      subclasses: [
        {
          id: "voie-du-roc",
          classId: "barbarian",
          name: "Voie du roc",
          blurb: "Pour les tests.",
          features: [
            {
              level: 3,
              name: "Peau de pierre",
              summary: "Résistance au poison, Sagesse en défense, pour les tests.",
              uses: { max: { ability: "con", min: 1 }, recharge: "long" },
              mechanics: [
                { type: "resistance", damage: ["poison"] },
                { type: "saveProficiency", abilities: ["wis"] },
              ],
            },
          ],
        },
      ],
    },
  });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  const content = createContentOverlay([result.pack]);

  it("applies a pack feat's and a pack subclass feature's mechanics", () => {
    const d = withContent(content, () =>
      derive("barbarian", 3, {
        backgroundId: "custom",
        choices: [
          { choiceId: "background:custom:origin-feat", values: ["meca:eclaireur"] },
          { choiceId: "class:barbarian:subclass", values: ["meca:voie-du-roc"] },
        ],
      }),
    );
    expect(d.featIds).toContain("meca:eclaireur");
    expect(d.initiativeBonus).toBe(3 + 2);
    expect(d.speed).toBe(40);
    expect(d.resistances).toContain("poison");
    expect(d.proficientSaves).toContain("wis");
  });

  it("refuses a mechanic it does not know", () => {
    const bad = parseContentPack({
      format: "ak-pack/1",
      system: "dnd2024",
      id: "faux",
      name: "Faux",
      content: {
        feats: [
          {
            id: "x",
            name: "X",
            category: "origin",
            summary: "x",
            mechanics: [{ type: "voler", bonus: 3 }],
          },
        ],
      },
    });
    expect(bad.ok).toBe(false);
  });
});
