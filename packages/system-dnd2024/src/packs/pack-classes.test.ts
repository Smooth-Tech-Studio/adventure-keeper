import { describe, expect, it } from "vitest";
import { computeCharacterDerived } from "../character-rules";
import { allClasses, getClass, weaponMasteryCount } from "../classes";
import { fightingStyleLevel } from "../feats";
import { classFeatures } from "../features";
import { grantedSpellsFor } from "../granted-spells";
import { allInvocations, getInvocation } from "../invocations";
import { allLanguages, classLanguagePicks, grantedLanguages } from "../languages";
import { asiLevels } from "../progression";
import { resolveChoices } from "../resolve-choices";
import {
  cantripsKnown,
  maxSpellLevel,
  preparedSpellsCount,
  spellcastingAbility,
} from "../spellcasting";
import { classStartingEquipment } from "../starting-equipment";
import { subclassChoice, subclassLabel, subclassesFor } from "../subclasses";
import { withLocale } from "../locale";
import { withContent } from "./active";
import { contentPackToJson, parseContentPack } from "./parse";
import { createContentOverlay } from "./registry";
import { extractUsedContent } from "./snapshot";
import type { ContentPack } from "./schema";

const PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const CANTRIPS = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

const RAW = {
  format: "ak-pack/1",
  system: "dnd2024",
  id: "brumes",
  name: "Brumes",
  content: {
    classes: [
      {
        id: "lame-des-brumes",
        name: "Lame des brumes",
        blurb: "Une épée, un peu de brume, beaucoup de patience.",
        imageUrl: "https://images.example/lame.png",
        hitDie: 10,
        primaryAbility: ["dex", "cha"],
        savingThrows: ["dex", "cha"],
        suggestedScores: { str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 13 },
        skillChoices: { count: 2, from: ["acrobatics", "stealth", "persuasion"] },
        armorTraining: ["light", "medium"],
        weaponProficiency: { simple: true, martial: true },
        spellcasting: "half",
        spellcastingAbility: "cha",
        cantripsKnown: CANTRIPS,
        preparedSpells: PREPARED,
        weaponMastery: [{ level: 1, count: 2 }],
        asiLevels: [4, 8, 10, 12, 16],
        fightingStyleLevel: 2,
        languages: ["sylvan"],
        languagePicks: 1,
        subclassLabel: "Voile",
        spells: [{ spellId: "voile-de-brume", minLevel: 1, spellLevel: 1 }],
        startingEquipment: {
          options: [
            {
              id: "a",
              label: "Paquetage de la lame",
              items: [{ kind: "weapon", id: "rapier" }],
              gold: 10,
            },
            { id: "b", gold: 120 },
          ],
        },
        features: [
          {
            level: 1,
            name: "Pas de brume",
            summary: "Vous vous déplacez dans la brume sans bruit.",
            mechanics: [{ type: "speed", bonus: 5 }],
          },
          {
            level: 5,
            name: "Attaque supplémentaire",
            summary: "Deux attaques par action Attaque.",
          },
        ],
      },
    ],
    subclasses: [
      { id: "voile-gris", classId: "lame-des-brumes", name: "Voile gris", blurb: "Gris." },
    ],
    spells: [
      {
        id: "voile-de-brume",
        name: "Voile de brume",
        level: 1,
        school: "illusion",
        classes: ["lame-des-brumes", "wizard"],
        castingTime: "action",
        range: "Personnelle",
        components: { v: true, s: true, m: false },
        duration: "1 minute",
        concentration: false,
        ritual: false,
      },
    ],
  },
  translations: {
    en: {
      content: {
        classes: {
          "lame-des-brumes": {
            name: "Mist Blade",
            subclassLabel: "Veil",
            features: [{ name: "Mist Step" }],
          },
        },
      },
    },
  },
};

function pack(): ContentPack {
  const result = parseContentPack(RAW);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.pack;
}

const CLASS_ID = "brumes:lame-des-brumes";
const overlay = createContentOverlay([pack()]);
const inPack = <T>(fn: () => T): T => withContent(overlay, fn);

describe("a class from a content pack", () => {
  it("is listed with the SRD classes and found by its namespaced id", () => {
    inPack(() => {
      expect(allClasses().map((klass) => klass.id)).toContain(CLASS_ID);
      expect(getClass(CLASS_ID)?.hitDie).toBe(10);
      expect(getClass(CLASS_ID)?.imageUrl).toBe("https://images.example/lame.png");
    });
    expect(getClass(CLASS_ID)).toBeUndefined();
  });

  it("carries its tables: spells, mastery, improvements, fighting style, languages", () => {
    inPack(() => {
      expect(spellcastingAbility(CLASS_ID)).toBe("cha");
      expect(cantripsKnown(CLASS_ID, 4)).toBe(3);
      expect(preparedSpellsCount(CLASS_ID, 9)).toBe(9);
      expect(maxSpellLevel(CLASS_ID, 5)).toBe(2);
      expect(weaponMasteryCount(CLASS_ID, 1)).toBe(2);
      expect(asiLevels(CLASS_ID)).toEqual([4, 8, 10, 12, 16]);
      expect(fightingStyleLevel(CLASS_ID)).toBe(2);
      expect(classLanguagePicks(CLASS_ID)).toBe(1);
      expect(grantedLanguages({ classId: CLASS_ID }).map((l) => l.id)).toContain("sylvan");
    });
  });

  it("has its features, level by level", () => {
    inPack(() => {
      expect(classFeatures(CLASS_ID, 1).map((f) => f.name)).toEqual(["Pas de brume"]);
      expect(classFeatures(CLASS_ID, 5)).toHaveLength(2);
    });
  });

  it("grants its spells and its starting equipment", () => {
    inPack(() => {
      const granted = grantedSpellsFor({ classId: CLASS_ID, level: 1 });
      expect(granted.map((g) => g.spellId)).toEqual(["brumes:voile-de-brume"]);
      expect(granted[0].sourceLabel).toBe("Lame des brumes");
      const kit = classStartingEquipment(CLASS_ID);
      expect(kit?.options.map((o) => o.gold)).toEqual([10, 120]);
      expect(kit?.options[0].label).toBe("Paquetage de la lame");
    });
  });

  it("takes its subclasses, named by the class's slug, and their label", () => {
    inPack(() => {
      expect(subclassesFor(CLASS_ID).map((s) => s.id)).toEqual(["brumes:voile-gris"]);
      expect(subclassLabel(CLASS_ID)).toBe("Voile");
      expect(subclassChoice(CLASS_ID)?.pool).toEqual({
        kind: "list",
        values: ["brumes:voile-gris"],
      });
      const choices = resolveChoices({ classId: CLASS_ID, level: 3 });
      expect(choices.map((choice) => choice.id)).toContain(`class:${CLASS_ID}:subclass`);
    });
  });

  it("reads the spell's classes through the pack", () => {
    expect(overlay.spells.get("brumes:voile-de-brume")?.classes).toEqual([CLASS_ID, "wizard"]);
  });

  it("derives a sheet: hit points, saves, the feature's mechanic", () => {
    const derived = computeCharacterDerived(
      {
        classId: CLASS_ID,
        level: 1,
        baseAbilityScores: { str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 13 },
        backgroundAbilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        backgroundId: "soldier",
        speciesId: "human",
      },
      { content: overlay },
    );
    // d10 + Con +2.
    expect(derived.maxHitPoints).toBe(12);
    expect(derived.proficientSaves).toEqual(expect.arrayContaining(["dex", "cha"]));
    // Human 30 ft + Pas de brume 5 ft.
    expect(derived.speed).toBe(35);
  });

  it("is translated like every other entry", () => {
    withLocale("en", () => {
      const english = createContentOverlay([pack()]);
      expect(english.classes.get(CLASS_ID)?.name).toBe("Mist Blade");
      expect(english.classes.get(CLASS_ID)?.subclassLabel).toBe("Veil");
      expect(english.classFeatures.get(CLASS_ID)?.[0].name).toBe("Mist Step");
    });
  });

  it("is kept on a sheet that uses it, with the spell it grants", () => {
    const [kept] = extractUsedContent([pack()], [CLASS_ID]);
    expect(kept.content.classes.map((klass) => klass.id)).toEqual(["lame-des-brumes"]);
    expect(kept.content.spells.map((spell) => spell.id)).toEqual(["voile-de-brume"]);
  });

  it("refuses a subclass or a spell naming a class that exists nowhere", () => {
    const raw = JSON.parse(JSON.stringify(RAW)) as typeof RAW;
    raw.content.subclasses[0].classId = "artificier";
    const result = parseContentPack(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("aucune classe « artificier »");
  });
});

describe("an invocation from a content pack", () => {
  const raw = {
    format: "ak-pack/1",
    system: "dnd2024",
    id: "voiles",
    name: "Voiles",
    content: {
      invocations: [
        {
          id: "voile-de-brume",
          name: "Voile de brume",
          minLevel: 0,
          summary: "Brume.",
          darkvision: 60,
        },
        {
          id: "voile-epais",
          name: "Voile épais",
          minLevel: 5,
          requires: "voile-de-brume",
          summary: "Plus de brume.",
        },
      ],
    },
  };
  const parsed = parseContentPack(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const content = createContentOverlay([parsed.pack]);

  it("is found, with its prerequisite resolved inside the pack", () => {
    withContent(content, () => {
      expect(getInvocation("voiles:voile-epais")?.requires).toBe("voiles:voile-de-brume");
      expect(allInvocations().map((i) => i.id)).toContain("voiles:voile-de-brume");
    });
    expect(getInvocation("voiles:voile-de-brume")).toBeUndefined();
  });

  it("is kept on a sheet that took it, with the one it requires", () => {
    const [kept] = extractUsedContent([parsed.pack], ["voiles:voile-epais"]);
    expect(kept.content.invocations.map((i) => i.id)).toEqual(["voile-de-brume", "voile-epais"]);
  });
});

describe("equipment from a content pack", () => {
  const raw = {
    format: "ak-pack/1",
    system: "dnd2024",
    id: "forge",
    name: "Forge",
    content: {
      classes: [
        {
          ...RAW.content.classes[0],
          spells: undefined,
          startingEquipment: {
            options: [
              {
                id: "a",
                label: "Paquetage de forge",
                items: [
                  { kind: "weapon", id: "marteau-runique" },
                  { kind: "pack", id: "sac-de-forge" },
                  { kind: "gear", id: "rope" },
                ],
                gold: 5,
              },
              { id: "b", gold: 100 },
            ],
          },
        },
      ],
      weapons: [
        {
          id: "marteau-runique",
          name: "Marteau runique",
          category: "martial-melee",
          priceCp: 2000,
          damageDice: { count: 1, die: "d10" },
          damageType: "bludgeoning",
        },
      ],
      gear: [{ id: "enclume-de-poche", name: "Enclume de poche", priceCp: 500 }],
      equipmentPacks: [
        {
          id: "sac-de-forge",
          name: "Sac de forge",
          priceCp: 900,
          contents: [
            { gearId: "enclume-de-poche", qty: 1 },
            { gearId: "rope", qty: 1 },
          ],
        },
      ],
    },
  };
  const parsed = parseContentPack(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const content = createContentOverlay([parsed.pack]);
  const classId = "forge:lame-des-brumes";

  it("resolves a kit's items to the pack's own, or to the SRD's", () => {
    withContent(content, () => {
      expect(classStartingEquipment(classId)?.options[0].items.map((item) => item.id)).toEqual([
        "forge:marteau-runique",
        "forge:sac-de-forge",
        "rope",
      ]);
    });
    expect(content.equipmentPacks.get("forge:sac-de-forge")?.contents.map((l) => l.gearId)).toEqual(
      ["forge:enclume-de-poche", "rope"],
    );
  });

  it("is kept on a sheet whose class's kit uses it", () => {
    const [kept] = extractUsedContent([parsed.pack], [classId]);
    expect(kept.content.weapons.map((w) => w.id)).toEqual(["marteau-runique"]);
    expect(kept.content.equipmentPacks.map((p) => p.id)).toEqual(["sac-de-forge"]);
    // … with the pack's own gear inside it.
    expect(kept.content.gear.map((g) => g.id)).toEqual(["enclume-de-poche"]);
  });
});

describe("a language from a content pack", () => {
  const raw = {
    format: "ak-pack/1",
    system: "dnd2024",
    id: "cols",
    name: "Cols",
    content: {
      languages: [
        { id: "parler-des-cols", name: "Parler des cols", kind: "rare", summary: "Chuchoté." },
      ],
      species: [
        {
          id: "montagnard",
          name: "Montagnard",
          blurb: "Des cols.",
          size: "medium",
          speed: 30,
          languages: ["parler-des-cols", "dwarvish"],
        },
      ],
    },
  };
  const parsed = parseContentPack(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const content = createContentOverlay([parsed.pack]);

  it("is granted by the pack's species, next to an SRD one", () => {
    withContent(content, () => {
      const ids = grantedLanguages({ speciesId: "cols:montagnard" }).map((l) => l.id);
      expect(ids).toEqual(["common", "cols:parler-des-cols", "dwarvish"]);
      expect(allLanguages().map((l) => l.id)).toContain("cols:parler-des-cols");
    });
  });

  it("is kept with the species that grants it", () => {
    const [kept] = extractUsedContent([parsed.pack], ["cols:montagnard"]);
    expect(kept.content.languages.map((l) => l.id)).toEqual(["parler-des-cols"]);
  });

  it("refuses a language that exists nowhere", () => {
    const bad = JSON.parse(JSON.stringify(raw)) as typeof raw;
    bad.content.species[0].languages = ["langue-perdue"];
    const result = parseContentPack(bad);
    expect(result.ok ? [] : result.errors.join("\n")).toContain("aucune langue « langue-perdue »");
  });
});

describe("the system a pack file names", () => {
  const minimal = (system: string) => ({ format: "ak-pack/1", system, id: "p", name: "P" });

  it("is « 5e », the older « dnd2024 » still read; both stored the same", () => {
    for (const system of ["5e", "dnd2024"]) {
      const result = parseContentPack(minimal(system));
      expect(result.ok && result.pack.system).toBe("dnd2024");
    }
    expect(parseContentPack(minimal("pathfinder")).ok).toBe(false);
  });

  it("is written « 5e » on export", () => {
    const result = parseContentPack(minimal("dnd2024"));
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(contentPackToJson(result.pack)).toContain('"system": "5e"');
  });
});
