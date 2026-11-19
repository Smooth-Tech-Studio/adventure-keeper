import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { BACKGROUNDS, allBackgrounds, getBackground } from "../backgrounds";
import { computeCharacterDerived } from "../character-rules";
import { FEATS, featChoices, featsOfCategory, getFeat } from "../feats";
import { speciesFeatures } from "../features";
import { MONSTERS, allMonsters, getMonster } from "../monsters";
import { heldFeatIds } from "../resolve-choices";
import { grantedLanguages } from "../languages";
import { monsterAttacks } from "../monsters";
import { featBonusActions, featCombatNotes } from "../feats";
import {
  BACKGROUND_STARTING_EQUIPMENT,
  backgroundStartingEquipment,
  startingEquipmentById,
} from "../starting-equipment";
import {
  SPECIES,
  allSpecies,
  getSpecies,
  speciesDarkvision,
  speciesOptionLabel,
  speciesSpeed,
} from "../species";
import { SUBCLASSES, getSubclass, subclassesFor } from "../subclasses";
import { activeContent, setActiveContent, withContent } from "./active";
import EXAMPLE_PACK from "./fixtures/brumes-du-nord.json";
import { contentPackToJson, parseContentPack, parseContentPackJson } from "./parse";
import { createContentOverlay, mergeContentPacks } from "./registry";
import { extractUsedContent } from "./snapshot";
import { packLanguages, packText, translatedPackContent } from "./translations";
import { withLocale } from "../locale";
import { legacySubclassId, migrateSheetToPack } from "./migrate";
import {
  packBackgroundSchema,
  packFeatSchema,
  packMonsterSchema,
  packSpeciesSchema,
  packSubclassSchema,
  type ContentPack,
} from "./schema";

const RAW = EXAMPLE_PACK as Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function examplePack(): ContentPack {
  const result = parseContentPack(RAW);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.pack;
}

/** The fixture with `patch` applied to one entry of `content[kind]`. */
function withEntry(kind: string, index: number, patch: Record<string, unknown>) {
  const raw = clone(RAW) as { content: Record<string, Record<string, unknown>[]> };
  raw.content[kind][index] = { ...raw.content[kind][index], ...patch };
  return raw;
}

function errorsOf(raw: unknown): string[] {
  const result = parseContentPack(raw);
  return result.ok ? [] : result.errors;
}

describe("parseContentPack", () => {
  it("accepts the example pack and fills defaults", () => {
    const pack = examplePack();
    expect(pack.content.species).toHaveLength(1);
    expect(pack.content.feats).toHaveLength(2);
    expect(pack.content.monsters[0].speed).toBe(40);
    expect(pack.content.subclasses[0].features).toHaveLength(2);
  });

  it("names the entry and the field in French when something is wrong", () => {
    const errors = errorsOf(withEntry("subclasses", 0, { classId: "artificer" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Sous-classe n°1 « Gardien des brumes » › classId");
    expect(errors[0]).toContain("aucune classe « artificer »");
  });

  it("reports a missing required field", () => {
    const errors = errorsOf(withEntry("feats", 1, { summary: undefined }));
    expect(errors).toEqual([
      "Don n°2 « Tireur des brumes » › summary : champ obligatoire manquant",
    ]);
  });

  it("rejects ids that are not slugs", () => {
    const errors = errorsOf(withEntry("monsters", 0, { id: "Loup des Brumes" }));
    expect(errors[0]).toContain("minuscules, chiffres et tirets");
  });

  it("rejects another format or system", () => {
    expect(errorsOf({ ...RAW, format: "ak-pack/2" })[0]).toContain("« ak-pack/1 »");
    expect(errorsOf({ ...RAW, system: "pf2e" })[0]).toContain("« 5e »");
  });

  it("rejects an id used twice in the same kind", () => {
    const raw = clone(RAW) as { content: { feats: unknown[] } };
    raw.content.feats.push(raw.content.feats[0]);
    expect(errorsOf(raw)).toEqual([
      "Don : l'identifiant « endurci-par-le-froid » est utilisé deux fois.",
    ]);
  });

  it("rejects an origin feat that exists neither in the pack nor in the SRD", () => {
    const errors = errorsOf(withEntry("backgrounds", 1, { originFeatId: "inexistant" }));
    expect(errors[0]).toContain("Historique « Veilleur » › originFeatId");
  });

  it("rejects lineages that are not options of the species choice", () => {
    const raw = clone(RAW) as {
      content: { species: { lineages: Record<string, unknown> }[] };
    };
    raw.content.species[0].lineages["Brume rouge"] = { summary: "?" };
    expect(errorsOf(raw)[0]).toContain("« Brume rouge » n'est pas une des options");
  });

  it("rejects unknown fields, naming the entry and the keys", () => {
    const errors = errorsOf(withEntry("feats", 1, { combatNotes: "typo" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Don n°2 « .+ » : champ\(s\) inconnu\(s\) : combatNotes$/);
  });

  it("rejects unknown fields nested in an entry and at the top level", () => {
    const raw = clone(RAW) as {
      auteur?: string;
      content: { monsters: { attacks: { damage: Record<string, unknown> }[] }[] };
    };
    raw.content.monsters[0].attacks[0].damage.faces = 4;
    raw.auteur = "moi";
    const errors = errorsOf(raw);
    expect(errors).toHaveLength(2);
    expect(errors).toContain("Pack : champ(s) inconnu(s) : auteur");
    expect(errors.some((e) => e.includes("› attacks.0.damage : champ(s) inconnu(s) : faces"))).toBe(
      true,
    );
  });

  it("keeps lineage names, which are keys of a record, not fields", () => {
    const species = (RAW.content as { species: { lineages?: object }[] }).species[0];
    expect(Object.keys(species.lineages ?? {})).not.toHaveLength(0);
    expect(errorsOf(RAW)).toEqual([]);
  });

  it("explains a file that is not JSON", () => {
    const result = parseContentPackJson("{ pas du json");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toContain("pas du JSON valide");
  });

  it("round-trips through export", () => {
    const pack = examplePack();
    const again = parseContentPackJson(contentPackToJson(pack));
    expect(again).toEqual({ ok: true, pack });
  });
});

describe("createContentOverlay", () => {
  const overlay = createContentOverlay([examplePack()]);

  it("namespaces every id with the pack id", () => {
    expect([...overlay.species.keys()]).toEqual(["brumes-du-nord:sylvain-des-brumes"]);
    expect(overlay.subclasses.has("brumes-du-nord:gardien-des-brumes")).toBe(true);
    expect(overlay.monsters.has("brumes-du-nord:loup-des-brumes")).toBe(true);
    expect(overlay.packs).toEqual([
      { id: "brumes-du-nord", name: "Les Brumes du Nord", version: "1.0.0" },
    ]);
  });

  it("resolves references: same-pack slugs are namespaced, SRD ids kept", () => {
    expect(overlay.backgrounds.get("brumes-du-nord:passeur")?.originFeatId).toBe(
      "brumes-du-nord:endurci-par-le-froid",
    );
    expect(overlay.backgrounds.get("brumes-du-nord:veilleur")?.originFeatId).toBe("alert");
    const dense = overlay.species.get("brumes-du-nord:sylvain-des-brumes")?.lineages?.[
      "Brume dense"
    ];
    expect(dense?.spells?.[0].spellId).toBe("brumes-du-nord:voile-de-brume");
  });

  it("gives feat choices unique ids", () => {
    const feat = overlay.feats.get("brumes-du-nord:endurci-par-le-froid");
    expect(feat?.choices?.[0]).toMatchObject({
      id: "feat:brumes-du-nord:endurci-par-le-froid:competence",
      source: "feat",
    });
  });

  it("refuses two packs with the same id", () => {
    expect(() => createContentOverlay([examplePack(), examplePack()])).toThrow(
      "Deux packs portent l'identifiant « brumes-du-nord »",
    );
  });
});

describe("lookups with active content", () => {
  const overlay = createContentOverlay([examplePack()]);
  const SPECIES_ID = "brumes-du-nord:sylvain-des-brumes";

  it("see only the SRD by default", () => {
    expect(activeContent()).toBeNull();
    expect(getSpecies(SPECIES_ID)).toBeUndefined();
    expect(allSpecies()).toBe(SPECIES);
  });

  it("see the packs inside withContent, and stop seeing them after", () => {
    withContent(overlay, () => {
      expect(getSpecies(SPECIES_ID)?.name).toBe("Sylvain des brumes");
      expect(allSpecies()).toHaveLength(SPECIES.length + 1);
      expect(getBackground("brumes-du-nord:passeur")?.name).toBe("Passeur");
      expect(allBackgrounds().at(-1)?.id).toBe("brumes-du-nord:veilleur");
      expect(getFeat("brumes-du-nord:tireur-des-brumes")?.effects?.rangedAttackBonus).toBe(1);
      expect(featsOfCategory("general").at(-1)?.id).toBe("brumes-du-nord:tireur-des-brumes");
      expect(subclassesFor("fighter").map((s) => s.id)).toContain(
        "brumes-du-nord:gardien-des-brumes",
      );
      expect(getSubclass("brumes-du-nord:gardien-des-brumes")?.features).toHaveLength(2);
      expect(speciesFeatures(SPECIES_ID).map((f) => f.name)).toEqual([
        "Pas feutré",
        "Souffle glacé",
      ]);
      expect(getMonster("brumes-du-nord:loup-des-brumes")?.hitPoints).toBe(16);
      expect(allMonsters().at(-1)?.id).toBe("brumes-du-nord:loup-des-brumes");
      // SRD content is still there.
      expect(getSpecies("elf")?.id).toBe("elf");
      expect(getFeat("alert")).toBeDefined();
    });
    expect(getSpecies(SPECIES_ID)).toBeUndefined();
  });

  it("restores the previous content even when the callback throws", () => {
    expect(() =>
      withContent(overlay, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(activeContent()).toBeNull();
  });

  it("can be set as the default and cleared", () => {
    setActiveContent(overlay);
    try {
      expect(getSpecies(SPECIES_ID)).toBeDefined();
    } finally {
      setActiveContent(null);
    }
    expect(getSpecies(SPECIES_ID)).toBeUndefined();
  });

  it("feed species and lineage numbers to the engine helpers", () => {
    withContent(overlay, () => {
      expect(speciesSpeed(SPECIES_ID, "Brume légère")).toBe(35);
      expect(speciesSpeed(SPECIES_ID, "Brume dense")).toBe(30);
      expect(speciesDarkvision(SPECIES_ID, "Brume dense")).toBe(120);
    });
  });

  it("open a pack feat's own choices when the feat is held", () => {
    withContent(overlay, () => {
      const held = heldFeatIds({ backgroundId: "brumes-du-nord:passeur", level: 1 });
      expect(held).toContain("brumes-du-nord:endurci-par-le-froid");
      expect(featChoices(held).map((c) => c.id)).toContain(
        "feat:brumes-du-nord:endurci-par-le-froid:competence",
      );
    });
  });
});

describe("computeCharacterDerived with packs", () => {
  const overlay = createContentOverlay([examplePack()]);
  const input = {
    classId: "fighter",
    level: 3,
    baseAbilityScores: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
    backgroundAbilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    backgroundId: "brumes-du-nord:passeur",
    speciesId: "brumes-du-nord:sylvain-des-brumes",
    speciesChoice: "Brume dense",
    subclassId: "brumes-du-nord:gardien-des-brumes",
  } as const;

  it("reads pack species, background and origin feat when given the content", () => {
    const withPacks = computeCharacterDerived(input, { content: overlay });
    const srdOnly = computeCharacterDerived(input, { content: null });
    // Endurci par le froid: +1 HP per level, via the pack background.
    expect(withPacks.maxHitPoints - srdOnly.maxHitPoints).toBe(3);
    expect(withPacks.darkvision).toBe(120);
    expect(withPacks.resistances).toContain("cold");
    expect(srdOnly.resistances).not.toContain("cold");
  });

  it("leaves the active content untouched", () => {
    computeCharacterDerived(input, { content: overlay });
    expect(activeContent()).toBeNull();
  });
});

/**
 * Lot 4 moves the non-SRD content out of the code into packs: every built-in
 * entry must therefore be expressible in the pack format. A new engine field
 * the format lacks fails here instead of being lost in that move.
 */
describe("the pack format can express all built-in content", () => {
  const slug = (id: string) => id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const failures = (schema: z.ZodTypeAny, items: unknown[]) =>
    items.flatMap((item) => {
      const result = schema.safeParse(item);
      return result.success ? [] : [`${(item as { id: string }).id}: ${result.error.message}`];
    });

  it("species, with their traits", () => {
    const items = SPECIES.map((species) => ({
      ...species,
      traits: speciesFeatures(species.id).map(({ name, summary, uses }) => ({
        name,
        summary,
        uses,
      })),
    }));
    expect(failures(packSpeciesSchema, items)).toEqual([]);
  });

  it("backgrounds, subclasses and monsters", () => {
    const lastSegment = (id: string) => id.split(":").at(-1) ?? id;
    const backgrounds = BACKGROUNDS.filter((b) => b.id !== "custom").map((background) => {
      const kit = BACKGROUND_STARTING_EQUIPMENT[
        background.id as keyof typeof BACKGROUND_STARTING_EQUIPMENT
      ]?.options.find((option) => option.id === "a");
      return {
        ...background,
        startingKit: kit && {
          gold: kit.gold,
          items: kit.items.map(({ fromChoice, ...item }) =>
            fromChoice ? { ...item, fromChoice: lastSegment(fromChoice) } : item,
          ),
          choices: kit.choices?.map(({ source: _s, via: _v, ...choice }) => ({
            ...choice,
            id: lastSegment(choice.id),
          })),
        },
      };
    });
    expect(failures(packBackgroundSchema, backgrounds)).toEqual([]);
    expect(
      failures(
        packSubclassSchema,
        SUBCLASSES.map((s) => ({ ...s, id: slug(s.id) })),
      ),
    ).toEqual([]);
    expect(failures(packMonsterSchema, MONSTERS)).toEqual([]);
  });

  it("feats, with their choices", () => {
    const items = FEATS.map((feat) => ({
      ...feat,
      choices: feat.choices?.map(({ source: _source, via: _via, ...choice }) => ({
        ...choice,
        id: slug(choice.id.split(":").at(-1) ?? choice.id),
      })),
    }));
    expect(failures(packFeatSchema, items)).toEqual([]);
  });
});

describe("extractUsedContent", () => {
  it("keeps only the referenced entries, and what they point to in the same pack", () => {
    const [kept] = extractUsedContent(
      [examplePack()],
      [
        "brumes-du-nord:sylvain-des-brumes",
        "brumes-du-nord:passeur",
        "elf", // SRD: ignored
      ],
    );
    expect(kept.id).toBe("brumes-du-nord");
    expect(kept.content.species.map((s) => s.id)).toEqual(["sylvain-des-brumes"]);
    expect(kept.content.backgrounds.map((b) => b.id)).toEqual(["passeur"]);
    // Pulled in by the background (origin feat) and the species (lineage spell).
    expect(kept.content.feats.map((f) => f.id)).toEqual(["endurci-par-le-froid"]);
    expect(kept.content.spells.map((s) => s.id)).toEqual(["voile-de-brume"]);
    expect(kept.content.subclasses).toEqual([]);
    expect(kept.content.monsters).toEqual([]);
  });

  it("drops packs nothing is used from", () => {
    expect(extractUsedContent([examplePack()], ["elf", "alert"])).toEqual([]);
  });

  it("derives the same sheet from the extract as from the whole pack", () => {
    const input = {
      classId: "fighter",
      level: 3,
      baseAbilityScores: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
      backgroundAbilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      backgroundId: "brumes-du-nord:passeur",
      speciesId: "brumes-du-nord:sylvain-des-brumes",
      speciesChoice: "Brume dense",
    };
    const full = createContentOverlay([examplePack()]);
    const extract = createContentOverlay(
      extractUsedContent([examplePack()], [input.speciesId, input.backgroundId]),
    );
    expect(computeCharacterDerived(input, { content: extract })).toEqual(
      computeCharacterDerived(input, { content: full }),
    );
  });
});

describe("mergeContentPacks", () => {
  it("folds copies of a pack into one, the first copy winning", () => {
    const library = examplePack();
    const sheetCopy = extractUsedContent([library], ["brumes-du-nord:passeur"])[0];
    const renamed = {
      ...sheetCopy,
      name: "Ancien nom",
      content: {
        ...sheetCopy.content,
        backgrounds: sheetCopy.content.backgrounds.map((b) => ({ ...b, name: "Ancien passeur" })),
      },
    };
    const [merged] = mergeContentPacks([library, renamed]);
    expect(merged.name).toBe("Les Brumes du Nord");
    expect(merged.content.backgrounds.find((b) => b.id === "passeur")?.name).toBe("Passeur");
    expect(merged.content.backgrounds).toHaveLength(2);
  });

  it("keeps entries only an older copy still has", () => {
    const library = examplePack();
    const trimmed = { ...library, content: { ...library.content, monsters: [] } };
    const [merged] = mergeContentPacks([trimmed, library]);
    expect(merged.content.monsters.map((m) => m.id)).toEqual(["loup-des-brumes"]);
  });
});

describe("starting kits of pack backgrounds", () => {
  const overlay = createContentOverlay([examplePack()]);

  it("build the package plus the 50 po option, with the kit's own picks", () => {
    withContent(overlay, () => {
      const def = backgroundStartingEquipment("brumes-du-nord:veilleur");
      expect(def?.id).toBe("background:brumes-du-nord:veilleur");
      expect(def?.options.map((o) => [o.id, o.gold])).toEqual([
        ["a", 5],
        ["b", 50],
      ]);
      const kit = def?.options[0];
      expect(kit?.items).toContainEqual({
        kind: "tool",
        fromChoice: "background:brumes-du-nord:veilleur:jeu",
      });
      expect(kit?.choices?.map((c) => [c.id, c.source])).toEqual([
        ["background:brumes-du-nord:veilleur:jeu", "background"],
      ]);
      // The owner id round-trips although the background id holds a colon.
      expect(startingEquipmentById("background:brumes-du-nord:veilleur")).toEqual(def);
    });
  });

  it("give a pack background no package while its pack is not active", () => {
    expect(backgroundStartingEquipment("brumes-du-nord:veilleur")).toBeUndefined();
  });
});

describe("migrateSheetToPack", () => {
  /** A sheet written while the example pack's content was built in. */
  const legacy = {
    speciesId: "sylvain-des-brumes",
    backgroundId: "passeur",
    cantrips: ["light"],
    spells: ["voile-de-brume", "shield"],
    choices: [
      { choiceId: "species:sylvain-des-brumes:lineage", values: ["Brume dense"] },
      { choiceId: "background:passeur:equipment", values: ["a"] },
      { choiceId: "feat:endurci-par-le-froid:competence", values: ["survival"] },
      { choiceId: "level:4:feat", values: ["tireur-des-brumes"] },
      { choiceId: "class:fighter:skills", values: ["athletics", "perception"] },
    ],
  };

  it("namespaces fields, picked values and the choice ids those entries opened", () => {
    const { changed, sheet } = migrateSheetToPack(legacy, examplePack());
    expect(changed).toBe(true);
    expect(sheet.speciesId).toBe("brumes-du-nord:sylvain-des-brumes");
    expect(sheet.backgroundId).toBe("brumes-du-nord:passeur");
    expect(sheet.cantrips).toEqual(["light"]);
    expect(sheet.spells).toEqual(["brumes-du-nord:voile-de-brume", "shield"]);
    expect(sheet.choices).toEqual([
      { choiceId: "species:brumes-du-nord:sylvain-des-brumes:lineage", values: ["Brume dense"] },
      { choiceId: "background:brumes-du-nord:passeur:equipment", values: ["a"] },
      { choiceId: "feat:brumes-du-nord:endurci-par-le-froid:competence", values: ["survival"] },
      { choiceId: "level:4:feat", values: ["brumes-du-nord:tireur-des-brumes"] },
      { choiceId: "class:fighter:skills", values: ["athletics", "perception"] },
    ]);
  });

  it("gives the sheet a copy of exactly what it now uses", () => {
    const { sheet } = migrateSheetToPack(legacy, examplePack());
    const [copy] = sheet.packContent ?? [];
    expect(copy.content.species.map((e) => e.id)).toEqual(["sylvain-des-brumes"]);
    expect(copy.content.backgrounds.map((e) => e.id)).toEqual(["passeur"]);
    expect(copy.content.feats.map((e) => e.id).sort()).toEqual([
      "endurci-par-le-froid",
      "tireur-des-brumes",
    ]);
    expect(copy.content.spells.map((e) => e.id)).toEqual(["voile-de-brume"]);
  });

  it("leaves a sheet that uses none of the pack untouched, and is idempotent", () => {
    const srdOnly = { speciesId: "elf", backgroundId: "sage", choices: [] };
    expect(migrateSheetToPack(srdOnly, examplePack())).toEqual({ changed: false, sheet: srdOnly });
    const once = migrateSheetToPack(legacy, examplePack()).sheet;
    expect(migrateSheetToPack(once, examplePack()).changed).toBe(false);
  });

  it("maps a subclass from its former class-prefixed id", () => {
    const pack = examplePack();
    pack.content.subclasses[0] = {
      ...pack.content.subclasses[0],
      id: "fighter-gardien-des-brumes",
    };
    const { sheet } = migrateSheetToPack(
      { choices: [{ choiceId: "class:fighter:subclass", values: ["fighter:gardien-des-brumes"] }] },
      pack,
    );
    expect(sheet.choices?.[0].values).toEqual(["brumes-du-nord:fighter-gardien-des-brumes"]);
    expect(legacySubclassId({ id: "druid-cercle-de-la-lune", classId: "druid" })).toBe(
      "druid:cercle-de-la-lune",
    );
  });

  it("derives the same sheet after migration as with the content built in", () => {
    const input = {
      classId: "fighter",
      level: 4,
      baseAbilityScores: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
      backgroundAbilityBonuses: { str: 0, dex: 0, con: 2, int: 0, wis: 1, cha: 0 },
    };
    // « Built in » = the pack's entries under their bare ids, as the code had them.
    const builtIn = createContentOverlay([{ ...examplePack(), id: "x" }]);
    const bare = (id: string) => `x:${id}`;
    const before = computeCharacterDerived(
      {
        ...input,
        speciesId: bare(legacy.speciesId),
        backgroundId: bare(legacy.backgroundId),
        speciesChoice: "Brume dense",
      },
      { content: builtIn },
    );
    const { sheet } = migrateSheetToPack(legacy, examplePack());
    const after = computeCharacterDerived(
      {
        ...input,
        speciesId: sheet.speciesId,
        backgroundId: sheet.backgroundId,
        speciesChoice: "Brume dense",
      },
      { content: createContentOverlay(sheet.packContent ?? []) },
    );
    expect(after.maxHitPoints).toBe(before.maxHitPoints);
    expect(after.darkvision).toBe(before.darkvision);
    expect(after.resistances).toEqual(before.resistances);
  });
});

describe("what a pack carries beyond the entry itself", () => {
  const overlay = createContentOverlay([examplePack()]);

  it("species languages, monster attacks, feat combat notes and bonus actions", () => {
    withContent(overlay, () => {
      expect(
        grantedLanguages({ speciesId: "brumes-du-nord:sylvain-des-brumes" }).find(
          (l) => l.sourceKind === "species",
        )?.id,
      ).toBe("sylvan");
      expect(monsterAttacks("brumes-du-nord:loup-des-brumes")[0]).toMatchObject({
        name: "Morsure",
        damage: { count: 2, die: "d4" },
      });
      const feat = ["brumes-du-nord:tireur-des-brumes"];
      expect(featCombatNotes(feat)).toEqual([
        "Tireur des brumes : +1 aux attaques à distance (déjà appliqué).",
      ]);
      expect(featBonusActions(feat)).toEqual(["Visée dans la brume (repérer une cible cachée)"]);
    });
  });
});

describe("pack tools", () => {
  const overlay = createContentOverlay([examplePack()]);

  it("namespace the tool and the references to it", () => {
    expect(overlay.tools.get("brumes-du-nord:jeu-des-brumes")).toMatchObject({
      name: "Jeu des brumes",
      category: "gaming",
    });
    expect(overlay.backgrounds.get("brumes-du-nord:veilleur")?.toolProficiency).toEqual({
      label: "Jeu des brumes",
      toolId: "brumes-du-nord:jeu-des-brumes",
    });
  });

  it("travel with the background that grants them", () => {
    const [copy] = extractUsedContent([examplePack()], ["brumes-du-nord:veilleur"]);
    expect(copy.content.tools.map((t) => t.id)).toEqual(["jeu-des-brumes"]);
  });

  it("are renamed wherever a sheet holds one", () => {
    const { sheet } = migrateSheetToPack(
      {
        toolProficiencies: ["jeu-des-brumes", "thieves-tools"],
        toolExpertise: ["jeu-des-brumes"],
        tools: [{ catalogId: "jeu-des-brumes" }, { catalogId: "thieves-tools" }],
        inventory: [{ catalogId: "rope" }],
        choices: [{ choiceId: "background:soldier:tool", values: ["jeu-des-brumes"] }],
      },
      examplePack(),
    );
    expect(sheet.toolProficiencies).toEqual(["brumes-du-nord:jeu-des-brumes", "thieves-tools"]);
    expect(sheet.toolExpertise).toEqual(["brumes-du-nord:jeu-des-brumes"]);
    expect(sheet.tools).toEqual([
      { catalogId: "brumes-du-nord:jeu-des-brumes" },
      { catalogId: "thieves-tools" },
    ]);
    expect(sheet.inventory).toEqual([{ catalogId: "rope" }]);
    expect(sheet.choices?.[0].values).toEqual(["brumes-du-nord:jeu-des-brumes"]);
    expect(sheet.packContent?.[0].content.tools.map((t) => t.id)).toEqual(["jeu-des-brumes"]);
  });
});

describe("migrateSheetToPack without copying content", () => {
  it("renames the ids and leaves the sheet's copy as it was", () => {
    const { changed, sheet } = migrateSheetToPack(
      { speciesId: "sylvain-des-brumes", packContent: [] },
      examplePack(),
      { copyContent: false },
    );
    expect(changed).toBe(true);
    expect(sheet.speciesId).toBe("brumes-du-nord:sylvain-des-brumes");
    expect(sheet.packContent).toEqual([]);
  });
});

describe("pack translations", () => {
  const pack = () => examplePack();
  const sylvan = "brumes-du-nord:sylvain-des-brumes";

  it("accepts the example pack's English translation", () => {
    expect(packLanguages(pack())).toEqual(["fr", "en"]);
  });

  it("rejects a translation that names no entry, or a text the pack does not have", () => {
    const raw = clone(RAW) as { translations: { en: { content: Record<string, unknown> } } };
    raw.translations.en.content.spells = {
      inconnu: { name: "Unknown" },
      "voile-de-brume": { duration: "1 minute", damage: { note: "x" } },
    };
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.includes("translations.en.content.spells.inconnu"))).toBe(true);
    expect(errors.some((e) => e.includes("voile-de-brume.damage"))).toBe(true);
    expect(errors.some((e) => e.endsWith("voile-de-brume.duration"))).toBe(false);
  });

  it("rejects a translation into the pack's own language, and non-text fields", () => {
    const raw = clone(RAW) as Record<string, unknown> & {
      translations: Record<string, { content: Record<string, Record<string, unknown>> }>;
    };
    raw.translations.fr = { content: {} };
    raw.translations.en.content.monsters = { "loup-des-brumes": { armorClass: 14 } };
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.startsWith("translations.fr"))).toBe(true);
    expect(errors.some((e) => e.includes("armorClass"))).toBe(true);
  });

  it("makes the pack's entries follow the locale, without touching the pack", () => {
    const source = pack();
    const json = contentPackToJson(source);
    withContent(createContentOverlay([source]), () => {
      expect(getSpecies(sylvan)?.name).toBe("Sylvain des brumes");
      withLocale("en", () => {
        expect(getSpecies(sylvan)?.name).toBe("Mist Sylvan");
        expect(speciesFeatures(sylvan).map((trait) => trait.name)).toContain("Soft Step");
        expect(getFeat("brumes-du-nord:tireur-des-brumes")?.combatNote).toMatch(/^Mist Archer/);
        expect(getMonster("brumes-du-nord:loup-des-brumes")?.attacks?.[0].name).toBe("Bite");
        expect(contentPackToJson(source)).toBe(json);
      });
    });
  });

  it("translates stored options for display only", () => {
    withContent(createContentOverlay([pack()]), () => {
      withLocale("en", () => {
        expect(speciesOptionLabel(sylvan, "Brume dense")).toBe("Dense Mist");
        expect(getSpecies(sylvan)?.choice?.options).toEqual(["Brume légère", "Brume dense"]);
        expect(getSpecies(sylvan)?.lineages?.["Brume dense"]?.summary).toMatch(/^Darkvision/);
      });
      expect(speciesOptionLabel(sylvan, "Brume dense")).toBe("Brume dense");
    });
  });

  it("reads a pack written in English with its French translation", () => {
    const raw = clone(RAW) as Record<string, unknown>;
    raw.language = "en";
    raw.content = {
      feats: [{ id: "watcher", name: "Watcher", category: "origin", summary: "You keep watch." }],
    };
    raw.translations = { fr: { content: { feats: { watcher: { name: "Veilleur" } } } } };
    const result = parseContentPack(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    withContent(createContentOverlay([result.pack]), () => {
      expect(getFeat("brumes-du-nord:watcher")?.name).toBe("Veilleur");
      withLocale("en", () => expect(getFeat("brumes-du-nord:watcher")?.name).toBe("Watcher"));
    });
  });

  it("gives the pack's name and a translated copy of its content for display", () => {
    const source = pack();
    expect(packText(source, "name")).toBe("Les Brumes du Nord");
    withLocale("en", () => {
      expect(packText(source, "name")).toBe("The Northern Mists");
      expect(packText(source, "author")).toBe("Adventure Keeper");
      expect(translatedPackContent(source).spells[0].name).toBe("Mist Veil");
    });
    expect(translatedPackContent(source)).toBe(source.content);
  });

  it("keeps the translations of the entries a sheet keeps, and merges them", () => {
    const [extract] = extractUsedContent([pack()], ["brumes-du-nord:voile-de-brume"]);
    expect(Object.keys(extract.translations?.en?.content.spells ?? {})).toEqual(["voile-de-brume"]);
    expect(extract.translations?.en?.content.feats).toEqual({});
    const bare = { ...pack(), translations: undefined, content: { ...pack().content, spells: [] } };
    const [merged] = mergeContentPacks([bare, pack()]);
    expect(merged.translations?.en?.content.spells?.["voile-de-brume"]?.name).toBe("Mist Veil");
  });
});
