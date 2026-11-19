import { describe, expect, it } from "vitest";
import { grantedSpellsFor, spellcastingWith } from "./granted-spells";

describe("grantedSpellsFor", () => {
  it("gives the Druid Communication avec les animaux from level 1", () => {
    const granted = grantedSpellsFor({ classId: "druid", level: 1 });
    expect(granted).toEqual([
      {
        spellId: "speak-with-animals",
        source: "class",
        sourceLabel: "Druidique",
        minLevel: 1,
        spellLevel: 1,
        countsAgainstPrepared: false,
      },
    ]);
  });

  it("gives the Ranger Marque du chasseur from level 1", () => {
    expect(grantedSpellsFor({ classId: "ranger", level: 3 }).map((g) => g.spellId)).toEqual([
      "hunters-mark",
    ]);
  });

  it("returns nothing for a class with no always-prepared grant", () => {
    expect(grantedSpellsFor({ classId: "wizard", level: 20 })).toEqual([]);
    expect(grantedSpellsFor({ classId: "cleric", level: 5 })).toEqual([]);
  });

  it("defaults to level 1 and clamps below it", () => {
    expect(grantedSpellsFor({ classId: "druid" })).toHaveLength(1);
    expect(grantedSpellsFor({ classId: "druid", level: 0 })).toHaveLength(1);
  });
});

describe("grantedSpellsFor — species", () => {
  const ids = (input: Parameters<typeof grantedSpellsFor>[0]) =>
    grantedSpellsFor(input).map((g) => g.spellId);

  it("gives a Drow the cantrip at level 1, then a spell at levels 3 and 5", () => {
    const base = { classId: "fighter", speciesId: "elf", speciesChoice: "Drow" };
    expect(ids({ ...base, level: 1 })).toEqual(["dancing-lights"]);
    expect(ids({ ...base, level: 3 })).toEqual(["dancing-lights", "faerie-fire"]);
    expect(ids({ ...base, level: 5 })).toEqual(["dancing-lights", "faerie-fire", "darkness"]);
  });

  it("differs per elven lineage", () => {
    const at5 = (speciesChoice: string) =>
      ids({ classId: "fighter", level: 5, speciesId: "elf", speciesChoice });
    expect(at5("Haut-elfe")).toEqual(["prestidigitation", "detect-magic", "misty-step"]);
    expect(at5("Elfe des bois")).toEqual(["druidcraft", "longstrider", "pass-without-trace"]);
  });

  it("grants nothing before a lineage is chosen", () => {
    expect(ids({ classId: "fighter", level: 5, speciesId: "elf" })).toEqual([]);
  });

  it("gives a Tieffelin Thaumaturgie plus the legacy's spells", () => {
    const base = { classId: "fighter", speciesId: "tiefling", speciesChoice: "Infernal" };
    expect(ids({ ...base, level: 1 })).toEqual(["thaumaturgy", "fire-bolt"]);
    expect(ids({ ...base, level: 5 })).toEqual([
      "thaumaturgy",
      "fire-bolt",
      "hellish-rebuke",
      "darkness",
    ]);
    // Thaumaturgy comes with the species even before a legacy is picked.
    expect(ids({ classId: "fighter", level: 1, speciesId: "tiefling" })).toEqual(["thaumaturgy"]);
  });

  it("tags species grants and keeps them out of the prepared-spell count", () => {
    const [grant] = grantedSpellsFor({
      classId: "fighter",
      level: 1,
      speciesId: "elf",
      speciesChoice: "Drow",
    });
    expect(grant).toMatchObject({
      source: "species",
      sourceLabel: "Lignage elfique (Drow)",
      spellLevel: 0,
      countsAgainstPrepared: false,
    });
  });

  it("stacks with a class grant", () => {
    expect(
      ids({ classId: "druid", level: 1, speciesId: "elf", speciesChoice: "Elfe des bois" }),
    ).toEqual(["druidcraft", "speak-with-animals"]);
  });
});

describe("grantedSpellsFor — subclasses", () => {
  const cleric = (level: number) =>
    grantedSpellsFor({
      classId: "cleric",
      level,
      picks: [{ choiceId: "class:cleric:subclass", values: ["cleric:domaine-de-la-vie"] }],
    });

  it("gives the domain spells by tier, from the subclass level", () => {
    expect(cleric(2)).toEqual([]);
    expect(cleric(3).map((g) => g.spellId)).toEqual([
      "aid",
      "bless",
      "cure-wounds",
      "lesser-restoration",
    ]);
    expect(cleric(5)).toHaveLength(6);
    expect(cleric(3)[0]).toMatchObject({
      source: "subclass",
      sourceLabel: "Domaine de la Vie",
      countsAgainstPrepared: false,
    });
  });

  it("follows the environment a Circle of the Land druid picked", () => {
    const druid = (environment?: string) =>
      grantedSpellsFor({
        classId: "druid",
        level: 3,
        picks: [
          { choiceId: "class:druid:subclass", values: ["druid:cercle-de-la-terre"] },
          ...(environment
            ? [{ choiceId: "class:druid:subclass-spells", values: [environment] }]
            : []),
        ],
      })
        .filter((g) => g.source === "subclass")
        .map((g) => g.spellId);
    expect(druid()).toEqual([]);
    expect(druid("Polaire")).toEqual(["fog-cloud", "hold-person", "ray-of-frost"]);
  });
});

describe("grantedSpellsFor — feats", () => {
  it("gives the spells « Initié à la magie » made the player pick, at their level", () => {
    const granted = grantedSpellsFor({
      classId: "rogue",
      level: 1,
      featIds: ["magic-initiate-wizard"],
      picks: [
        { choiceId: "feat:magic-initiate-wizard:cantrips", values: ["fire-bolt", "light"] },
        { choiceId: "feat:magic-initiate-wizard:spell", values: ["sleep"] },
      ],
    });
    expect(granted.map((g) => [g.spellId, g.spellLevel, g.source])).toEqual([
      ["fire-bolt", 0, "feat"],
      ["light", 0, "feat"],
      ["sleep", 1, "feat"],
    ]);
  });

  it("casts them with the ability picked for the feat, not the class's", () => {
    const granted = grantedSpellsFor({
      classId: "wizard",
      level: 1,
      featIds: ["magic-initiate-cleric"],
      picks: [
        { choiceId: "feat:magic-initiate-cleric:spell", values: ["bless"] },
        { choiceId: "feat:magic-initiate-cleric:ability", values: ["wis"] },
      ],
    });
    expect(granted).toEqual([expect.objectContaining({ spellId: "bless", ability: "wis" })]);
    // Without the pick, the sheet falls back to the class's ability.
    expect(
      grantedSpellsFor({
        classId: "wizard",
        featIds: ["magic-initiate-cleric"],
        picks: [{ choiceId: "feat:magic-initiate-cleric:spell", values: ["bless"] }],
      })[0].ability,
    ).toBeUndefined();
  });

  it("works out the DC and the attack of that ability", () => {
    const mods = { str: 0, dex: 0, con: 0, int: 1, wis: 3, cha: -1 };
    expect(spellcastingWith("wis", mods, 2)).toEqual({
      ability: "wis",
      saveDc: 13,
      attackBonus: 5,
    });
  });

  it("gives nothing for a feat not held", () => {
    expect(
      grantedSpellsFor({
        classId: "rogue",
        picks: [{ choiceId: "feat:magic-initiate-wizard:spell", values: ["sleep"] }],
      }),
    ).toEqual([]);
  });
});

describe("a spell granted twice", () => {
  it("comes once per source, with no replacement asked", () => {
    const granted = grantedSpellsFor({
      classId: "druid",
      level: 1,
      speciesId: "gnome",
      speciesChoice: "Gnome des forêts",
    });
    expect(
      granted.filter((grant) => grant.spellId === "speak-with-animals").map((g) => g.source),
    ).toEqual(["species", "class"]);
  });
});
