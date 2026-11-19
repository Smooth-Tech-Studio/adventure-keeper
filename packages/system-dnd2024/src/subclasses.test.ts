import { describe, expect, it } from "vitest";
import { CLASS_IDS, type ClassId } from "./classes";
import {
  SUBCLASSES,
  SUBCLASS_LEVEL,
  getSubclass,
  hasSubclass,
  subclassChoice,
  subclassFeatures,
  subclassIsDetailed,
  subclassesFor,
  subclassLabel,
} from "./subclasses";

describe("subclass catalogue", () => {
  it("has the 12 SRD subclasses — one per class", () => {
    expect(SUBCLASSES).toHaveLength(12);
    for (const classId of CLASS_IDS) {
      expect(subclassesFor(classId)).toHaveLength(1);
    }
  });

  it("has unique ids, each namespaced on its class", () => {
    const ids = SUBCLASSES.map((subclass) => subclass.id);
    expect(new Set(ids).size).toBe(12);
    for (const subclass of SUBCLASSES) {
      expect(subclass.id.startsWith(`${subclass.classId}:`)).toBe(true);
    }
  });

  it("slugifies accents and apostrophes out of the id", () => {
    expect(getSubclass("wizard:evocateur")?.name).toBe("Évocateur");
    expect(getSubclass("paladin:serment-de-devotion")?.name).toBe("Serment de Dévotion");
    expect(getSubclass("warlock:protecteur-fielon")?.name).toBe("Protecteur Fiélon");
  });

  it("labels the picker for every class", () => {
    for (const classId of CLASS_IDS) {
      expect(subclassLabel(classId)).not.toBe("Sous-classe");
    }
  });

  it("documents every subclass", () => {
    const detailed = SUBCLASSES.filter((subclass) => subclass.features.length > 0);
    expect(detailed.length).toBe(SUBCLASSES.length);
    for (const subclass of SUBCLASSES) {
      expect(subclassIsDetailed(subclass.id), subclass.id).toBe(true);
    }
  });

  it("lists each subclass's features in ascending level order", () => {
    // `subclassFeatures` preserves array order, so the sheet reads them as
    // stored: an entry out of order shows a level 20 feature above a level 15.
    for (const subclass of SUBCLASSES) {
      const levels = subclass.features.map((feature) => feature.level);
      expect(levels, subclass.id).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  it("carries every subclass up to its class's last tier", () => {
    // The level a class grants its final subclass feature at. Catching a
    // subclass that stops early is what a full-rules pass was for:
    // the freely-licensed source omitted most high-level entries.
    const lastTier: Record<ClassId, number> = {
      barbarian: 14,
      bard: 14,
      cleric: 17,
      druid: 14,
      fighter: 18,
      monk: 17,
      paladin: 20,
      ranger: 15,
      rogue: 17,
      sorcerer: 18,
      warlock: 14,
      wizard: 14,
    };
    for (const subclass of SUBCLASSES) {
      const top = Math.max(...subclass.features.map((feature) => feature.level));
      expect(top, subclass.id).toBe(lastTier[subclass.classId as ClassId]);
    }
  });

  it("gives every documented feature a level and a summary in our words", () => {
    for (const subclass of SUBCLASSES) {
      for (const feature of subclass.features) {
        expect(feature.level, `${subclass.id}/${feature.name}`).toBeGreaterThanOrEqual(3);
        expect(feature.level, `${subclass.id}/${feature.name}`).toBeLessThanOrEqual(20);
        expect(feature.name.length).toBeGreaterThan(0);
        expect(feature.summary.length, `${subclass.id}/${feature.name}`).toBeGreaterThan(30);
      }
    }
  });

  it("documents at least one subclass per class", () => {
    for (const classId of CLASS_IDS) {
      const detailed = subclassesFor(classId).filter((s) => s.features.length > 0);
      expect(detailed.length, classId).toBeGreaterThan(0);
    }
  });

  it("filters features by level", () => {
    const moon = "druid:cercle-de-la-terre";
    expect(subclassFeatures(moon, 2)).toEqual([]);
    expect(subclassFeatures(moon, 3).length).toBeGreaterThan(0);
    expect(subclassFeatures(moon, 20).length).toBeGreaterThan(subclassFeatures(moon, 3).length);
    for (const feature of subclassFeatures(moon, 6)) {
      expect(feature.level).toBeLessThanOrEqual(6);
    }
  });
});

describe("hasSubclass", () => {
  it("opens at level 3", () => {
    expect(SUBCLASS_LEVEL).toBe(3);
    expect(hasSubclass(2)).toBe(false);
    expect(hasSubclass(3)).toBe(true);
  });
});

describe("subclassChoice", () => {
  it("builds a level-3 option choice over that class's subclasses", () => {
    const choice = subclassChoice("paladin");
    expect(choice).toMatchObject({
      id: "class:paladin:subclass",
      source: "class",
      kind: "option",
      label: "Serment",
      count: 1,
      minLevel: 3,
    });
    expect(choice?.pool).toEqual({
      kind: "list",
      values: subclassesFor("paladin").map((subclass) => subclass.id),
    });
  });

  it("returns undefined for an unknown class", () => {
    expect(subclassChoice("nope")).toBeUndefined();
  });
});
