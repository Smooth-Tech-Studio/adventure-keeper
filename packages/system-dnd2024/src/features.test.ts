import { describe, expect, it } from "vitest";
import { CLASS_IDS } from "./classes";
import { SPECIES_FEATURES, classFeatures, speciesFeatures, speciesTraitsFor } from "./features";
import { SPECIES } from "./species";

describe("speciesFeatures", () => {
  it("covers every species — it is the single home of trait names", () => {
    // `SpeciesDef` deliberately carries no `traits` array: it used to repeat
    // these names without the summaries. Keep this the only source.
    for (const species of SPECIES) {
      expect(speciesFeatures(species.id).length, species.id).toBeGreaterThan(0);
    }
  });

  it("gives every trait a name and a summary in our words", () => {
    for (const feature of SPECIES_FEATURES) {
      expect(feature.name.length).toBeGreaterThan(0);
      expect(feature.summary.length).toBeGreaterThan(20);
    }
  });

  it("namespaces ids on the species and keeps them unique", () => {
    const ids = SPECIES_FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const feature of SPECIES_FEATURES) {
      expect(feature.id.startsWith(`${feature.speciesId}:`)).toBe(true);
    }
  });

  it("returns nothing for an unknown species", () => {
    expect(speciesFeatures("nope")).toEqual([]);
  });
});

describe("classFeatures", () => {
  it("gives every class something at level 1, and more by level 20", () => {
    for (const classId of CLASS_IDS) {
      const atOne = classFeatures(classId, 1);
      expect(atOne.length, classId).toBeGreaterThan(0);
      expect(classFeatures(classId, 20).length, classId).toBeGreaterThan(atOne.length);
    }
  });

  it("never returns a feature above the requested level", () => {
    for (const classId of CLASS_IDS) {
      for (const feature of classFeatures(classId, 5)) {
        expect(feature.level, `${classId}/${feature.name}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("returns nothing for an unknown class", () => {
    expect(classFeatures("nope", 20)).toEqual([]);
  });
});

describe("speciesTraitsFor", () => {
  it("tells only the chosen lineage once it is picked", () => {
    const names = (choice?: string) => speciesTraitsFor("gnome", choice).map((trait) => trait.name);
    expect(names()).toEqual(speciesFeatures("gnome").map((trait) => trait.name));
    const forest = speciesTraitsFor("gnome", "Gnome des forêts");
    expect(forest).toHaveLength(speciesFeatures("gnome").length);
    const lineage = forest.find((trait) => trait.id === "gnome:Lignage gnome")!;
    expect(lineage.name).toMatch(/Gnome des forêts/);
    expect(lineage.summary).not.toMatch(/Gnome des roches/);
  });

  it("replaces the trait of every species that has a choice, adding none", () => {
    for (const species of SPECIES.filter((entry) => entry.choice)) {
      const option = species.choice!.options[0];
      expect(speciesTraitsFor(species.id, option), species.id).toHaveLength(
        speciesFeatures(species.id).length,
      );
    }
  });
});
