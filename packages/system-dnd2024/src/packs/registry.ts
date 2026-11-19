/**
 * Turns validated packs into a {@link ContentOverlay}: the engine's own types
 * (`SpeciesDef`, `FeatDef`…) with namespaced ids, ready for the lookups to
 * consult on top of the SRD (see `active.ts`).
 */

import type { BackgroundDef } from "../backgrounds";
import { classFromEntry, type ClassDef } from "../classes";
import type { ChoiceDef } from "../choices";
import type { FeatDef } from "../feats";
import type { InvocationDef } from "../invocations";
import type { LanguageDef } from "../languages";
import type { ClassFeatureDef, SpeciesFeatureDef } from "../features";
import type { MonsterDef } from "../monsters";
import type { LineageSpellGrant, SpeciesDef } from "../species";
import type { SpellDef } from "../spells";
import type { SubclassDef } from "../subclasses";
import type { ToolDef } from "../tools";
import type { WeaponDef } from "../weapons";
import type { ArmorDef } from "../armors";
import type { EquipmentPackDef, GearDef } from "../gear";
import type { EquipmentRefKind } from "../equipment-options";
import { PACK_CONTENT_KINDS, type ContentPack, type PackContentKind } from "./schema";
import { pick } from "../locale";
import {
  entryShadows,
  packLanguage,
  positionalLabels,
  translateEntry,
  type PackDisplayLabels,
} from "./translations";

/** Pack content, keyed by namespaced id (`"pack:slug"`). */
export interface ContentOverlay {
  /** The packs it was built from, in order. */
  packs: readonly { id: string; name: string; version: string }[];
  /** Those packs themselves — what a saved sheet copies its entries from. */
  sourcePacks: readonly ContentPack[];
  classes: ReadonlyMap<string, ClassDef>;
  /** A pack class's features — the SRD keeps them in `features.ts`. */
  classFeatures: ReadonlyMap<string, ClassFeatureDef[]>;
  species: ReadonlyMap<string, SpeciesDef>;
  /** A pack species' traits — the SRD keeps them in `features.ts`. */
  speciesTraits: ReadonlyMap<string, SpeciesFeatureDef[]>;
  backgrounds: ReadonlyMap<string, BackgroundDef>;
  subclasses: ReadonlyMap<string, SubclassDef>;
  feats: ReadonlyMap<string, FeatDef>;
  spells: ReadonlyMap<string, SpellDef>;
  monsters: ReadonlyMap<string, MonsterDef>;
  invocations: ReadonlyMap<string, InvocationDef>;
  languages: ReadonlyMap<string, LanguageDef>;
  /** Pack tools — the catalogue is loaded on demand by the app, which merges these. */
  tools: ReadonlyMap<string, ToolDef>;
  weapons: ReadonlyMap<string, WeaponDef>;
  armors: ReadonlyMap<string, ArmorDef>;
  gear: ReadonlyMap<string, GearDef>;
  equipmentPacks: ReadonlyMap<string, EquipmentPackDef>;
  /** Display labels of a pack species' options, by species id (the stored option stays as is). */
  speciesOptionLabels: ReadonlyMap<string, PackDisplayLabels>;
  /** Display labels of pack subclasses' spell variants, by stored variant name. */
  spellVariantLabels: PackDisplayLabels;
}

/** `"pack:slug"` — the id a pack entry is known by everywhere else. */
export function packEntryId(packId: string, slug: string): string {
  return `${packId}:${slug}`;
}

/** The pack an id comes from, or `undefined` for SRD content. */
export function packIdOf(id: string): string | undefined {
  const separator = id.indexOf(":");
  return separator > 0 ? id.slice(0, separator) : undefined;
}

/**
 * How a reference written in a pack resolves: a slug the same pack defines
 * points there, a full `"pack:slug"` id is kept, anything else is an SRD id.
 */
export function resolvePackRef(packId: string, ref: string, local: ReadonlySet<string>): string {
  if (ref.includes(":")) return ref;
  return local.has(ref) ? packEntryId(packId, ref) : ref;
}

function localIds(pack: ContentPack, kind: PackContentKind): Set<string> {
  return new Set(pack.content[kind].map((entry) => entry.id));
}

function convertPack(pack: ContentPack) {
  const id = (slug: string) => packEntryId(pack.id, slug);
  const localFeats = localIds(pack, "feats");
  const localSpells = localIds(pack, "spells");
  const localTools = localIds(pack, "tools");
  const localClasses = localIds(pack, "classes");
  const toolRef = (ref: string) => resolvePackRef(pack.id, ref, localTools);
  const localItems: Record<EquipmentRefKind, Set<string>> = {
    weapon: localIds(pack, "weapons"),
    armor: localIds(pack, "armors"),
    tool: localTools,
    gear: localIds(pack, "gear"),
    pack: localIds(pack, "equipmentPacks"),
  };
  /** A kit line's item: one of this pack's, or the SRD catalogue's. */
  const itemRef = (kind: EquipmentRefKind, ref: string) =>
    resolvePackRef(pack.id, ref, localItems[kind]);
  const classRef = (ref: string) => resolvePackRef(pack.id, ref, localClasses);
  const localLanguages = localIds(pack, "languages");
  const languageRefs = (refs?: string[]) =>
    refs?.map((ref) => resolvePackRef(pack.id, ref, localLanguages));
  const spellRef = (grant: LineageSpellGrant): LineageSpellGrant => ({
    ...grant,
    spellId: resolvePackRef(pack.id, grant.spellId, localSpells),
  });

  const classes = pack.content.classes.map((entry) => {
    const { def, features } = classFromEntry(entry, id(entry.id), {
      tool: toolRef,
      spell: (ref) => resolvePackRef(pack.id, ref, localSpells),
      item: itemRef,
    });
    // An option's id is stored on the sheet: namespaced, like any pack id.
    const options = def.options?.map((choice) => ({
      ...choice,
      options: choice.options.map((option) => ({ ...option, id: id(option.id) })),
    }));
    return {
      def: {
        ...def,
        options,
        ...(def.languages && { languages: languageRefs([...def.languages]) }),
      },
      features,
    };
  });

  const species = pack.content.species.map((entry) => {
    const { traits, ...rest } = entry;
    const def: SpeciesDef = {
      ...rest,
      id: id(entry.id),
      languages: languageRefs(rest.languages),
      spells: entry.spells?.map(spellRef),
      lineages: entry.lineages
        ? Object.fromEntries(
            Object.entries(entry.lineages).map(([name, lineage]) => [
              name,
              { ...lineage, spells: lineage.spells?.map(spellRef) },
            ]),
          )
        : undefined,
    };
    const featureDefs: SpeciesFeatureDef[] = traits.map((trait) => ({
      ...trait,
      id: `${def.id}:${trait.name}`,
      speciesId: def.id,
    }));
    return { def, traits: featureDefs };
  });

  const backgrounds = pack.content.backgrounds.map((entry): BackgroundDef => {
    const backgroundId = id(entry.id);
    // A kit's own picks are the background's: `background:<id>:<slug>`.
    const ownChoice = (slug: string) => `background:${backgroundId}:${slug}`;
    const kit = entry.startingKit;
    return {
      ...entry,
      id: backgroundId,
      originFeatId: entry.originFeatId
        ? resolvePackRef(pack.id, entry.originFeatId, localFeats)
        : undefined,
      toolProficiency:
        entry.toolProficiency && "toolId" in entry.toolProficiency
          ? { ...entry.toolProficiency, toolId: toolRef(entry.toolProficiency.toolId) }
          : entry.toolProficiency,
      startingKit: kit && {
        gold: kit.gold,
        items: kit.items.map(({ fromChoice, ...item }) =>
          fromChoice
            ? { ...item, fromChoice: ownChoice(fromChoice) }
            : item.id
              ? { ...item, id: itemRef(item.kind, item.id) }
              : item,
        ),
        choices: kit.choices?.map((choice): ChoiceDef => ({
          ...choice,
          id: ownChoice(choice.id),
          source: "background",
        })),
      },
    };
  });

  const subclasses = pack.content.subclasses.map((entry): SubclassDef => ({
    ...entry,
    id: id(entry.id),
    classId: classRef(entry.classId),
    spells: entry.spells?.map(spellRef),
    spellVariants: entry.spellVariants && {
      ...entry.spellVariants,
      options: entry.spellVariants.options.map((option) => ({
        ...option,
        spells: option.spells.map(spellRef),
      })),
    },
  }));

  const feats = pack.content.feats.map((entry): FeatDef => {
    const featId = id(entry.id);
    return {
      ...entry,
      id: featId,
      choices: entry.choices?.map((choice): ChoiceDef => ({
        ...choice,
        id: `feat:${featId}:${choice.id}`,
        source: "feat",
      })),
    };
  });

  const spells = pack.content.spells.map((entry): SpellDef => ({
    ...entry,
    id: id(entry.id),
    classes: entry.classes.map(classRef),
  }));
  const monsters = pack.content.monsters.map((entry): MonsterDef => ({
    ...entry,
    id: id(entry.id),
  }));

  const localInvocations = localIds(pack, "invocations");
  const invocations = pack.content.invocations.map((entry): InvocationDef => ({
    ...entry,
    id: id(entry.id),
    requires: entry.requires && resolvePackRef(pack.id, entry.requires, localInvocations),
    spells: entry.spells?.map((grant) => ({
      ...grant,
      spellId: resolvePackRef(pack.id, grant.spellId, localSpells),
    })),
  }));

  const languages = pack.content.languages.map((entry): LanguageDef => ({
    ...entry,
    id: id(entry.id),
  }));
  const tools = pack.content.tools.map((entry): ToolDef => ({ ...entry, id: id(entry.id) }));
  const weapons = pack.content.weapons.map((entry): WeaponDef => ({ ...entry, id: id(entry.id) }));
  const armors = pack.content.armors.map((entry): ArmorDef => ({ ...entry, id: id(entry.id) }));
  const gear = pack.content.gear.map((entry): GearDef => ({ ...entry, id: id(entry.id) }));
  const equipmentPacks = pack.content.equipmentPacks.map((entry): EquipmentPackDef => ({
    ...entry,
    id: id(entry.id),
    contents: entry.contents.map((line) => ({ ...line, gearId: itemRef("gear", line.gearId) })),
  }));

  return {
    classes,
    species,
    backgrounds,
    subclasses,
    feats,
    spells,
    monsters,
    invocations,
    languages,
    tools,
    weapons,
    armors,
    gear,
    equipmentPacks,
  };
}

type Converted = ReturnType<typeof convertPack>;

/** A copy of a pack's translations deep enough to add entries to. */
const structuredCopy = (translations: ContentPack["translations"]) =>
  Object.fromEntries(
    Object.entries(translations ?? {}).map(([code, translation]) => [
      code,
      {
        ...translation,
        content: Object.fromEntries(
          Object.entries(translation.content).map(([kind, shadows]) => [kind, { ...shadows }]),
        ),
      },
    ]),
  ) as NonNullable<ContentPack["translations"]>;

/**
 * A deep copy, so translating the defs never touches the pack they come from —
 * the pack is what a sheet saves and what export writes, in its own language.
 */
const cloneConverted = (converted: Converted): Converted =>
  JSON.parse(JSON.stringify(converted)) as Converted;

/**
 * Lay a pack's translations over its converted defs: their texts follow the
 * locale. Defs come in the order of the pack's entries. Stored values — species
 * options, variant names — keep their text; their labels go to the overlay.
 */
function translateConverted(
  pack: ContentPack,
  converted: Converted,
  overlay: {
    speciesOptionLabels: Map<string, PackDisplayLabels>;
    spellVariantLabels: PackDisplayLabels;
  },
): Converted {
  const base = packLanguage(pack);
  type AnyShadow = Record<string, unknown>;
  const each = <K extends Exclude<PackContentKind, "species">>(kind: K, defs: object[]) =>
    defs.forEach((def, index) =>
      translateEntry(def, entryShadows(pack, kind, pack.content[kind][index].id), base),
    );

  converted.classes.forEach(({ def, features }, index) => {
    const entry = pack.content.classes[index];
    const shadows = entryShadows(pack, "classes", entry.id) as Partial<Record<string, AnyShadow>>;
    const own = Object.fromEntries(
      Object.entries(shadows).map(([code, shadow]) => {
        // The file says `spells`, the class `grantedSpells`; features are apart.
        const { features: _features, spells, ...rest } = shadow ?? {};
        return [code, { ...rest, grantedSpells: spells }];
      }),
    );
    translateEntry(def, own, base);
    translateEntry(
      features,
      Object.fromEntries(Object.entries(shadows).map(([code, shadow]) => [code, shadow?.features])),
      base,
    );
  });

  converted.species.forEach(({ def, traits }, index) => {
    const entry = pack.content.species[index];
    const shadows = entryShadows(pack, "species", entry.id) as Partial<Record<string, AnyShadow>>;
    const labels = positionalLabels(
      entry.choice?.options ?? [],
      Object.fromEntries(
        Object.entries(shadows).map(([code, shadow]) => [
          code,
          (shadow?.choice as AnyShadow | undefined)?.options as string[] | undefined,
        ]),
      ),
    );
    if (Object.keys(labels).length) overlay.speciesOptionLabels.set(def.id, labels);
    const own = Object.fromEntries(
      Object.entries(shadows).map(([code, shadow]) => {
        const { traits: _traits, choice, ...rest } = shadow ?? {};
        const { options: _options, ...choiceRest } = (choice as AnyShadow | undefined) ?? {};
        return [code, { ...rest, choice: choiceRest }];
      }),
    );
    translateEntry(def, own, base);
    translateEntry(
      traits,
      Object.fromEntries(Object.entries(shadows).map(([code, shadow]) => [code, shadow?.traits])),
      base,
    );
  });

  each("backgrounds", converted.backgrounds);
  converted.subclasses.forEach((def, index) => {
    const entry = pack.content.subclasses[index];
    const shadows = entryShadows(pack, "subclasses", entry.id) as Partial<
      Record<string, AnyShadow>
    >;
    const variantShadow = (shadow: AnyShadow | undefined) =>
      ((shadow?.spellVariants as AnyShadow | undefined)?.options ?? []) as AnyShadow[];
    const labels = positionalLabels(
      entry.spellVariants?.options.map((option) => option.name) ?? [],
      Object.fromEntries(
        Object.entries(shadows).map(([code, shadow]) => [
          code,
          variantShadow(shadow).map((option) => option?.name as string | undefined),
        ]),
      ),
    );
    for (const [code, table] of Object.entries(labels)) {
      const target = (overlay.spellVariantLabels as Record<string, Record<string, string>>)[code];
      (overlay.spellVariantLabels as Record<string, Record<string, string>>)[code] = {
        ...target,
        ...table,
      };
    }
    // The variant's name is stored on the sheet: only its summary is translated in place.
    const own = Object.fromEntries(
      Object.entries(shadows).map(([code, shadow]) => {
        if (!shadow?.spellVariants) return [code, shadow];
        const variants = shadow.spellVariants as AnyShadow;
        return [
          code,
          {
            ...shadow,
            spellVariants: {
              ...variants,
              options: variantShadow(shadow).map((option) => ({ summary: option?.summary })),
            },
          },
        ];
      }),
    );
    translateEntry(def, own as never, base);
  });
  each("feats", converted.feats);
  each("spells", converted.spells);
  each("monsters", converted.monsters);
  each("invocations", converted.invocations);
  each("languages", converted.languages);
  each("tools", converted.tools);
  each("weapons", converted.weapons);
  each("armors", converted.armors);
  each("gear", converted.gear);
  each("equipmentPacks", converted.equipmentPacks);
  return converted;
}

/**
 * Build the overlay for a set of validated packs (see `parseContentPack`).
 * Throws if two packs share an id — the namespacing relies on pack ids being
 * unique.
 */
export function createContentOverlay(packs: readonly ContentPack[]): ContentOverlay {
  const seen = new Set<string>();
  for (const pack of packs) {
    if (seen.has(pack.id)) {
      throw new Error(
        pick({
          fr: `Deux packs portent l'identifiant « ${pack.id} ».`,
          en: `Two packs share the id “${pack.id}”.`,
        }),
      );
    }
    seen.add(pack.id);
  }

  const overlay = {
    packs: packs.map(({ id, name, version }) => ({ id, name, version })),
    sourcePacks: packs,
    classes: new Map<string, ClassDef>(),
    classFeatures: new Map<string, ClassFeatureDef[]>(),
    species: new Map<string, SpeciesDef>(),
    speciesTraits: new Map<string, SpeciesFeatureDef[]>(),
    backgrounds: new Map<string, BackgroundDef>(),
    subclasses: new Map<string, SubclassDef>(),
    feats: new Map<string, FeatDef>(),
    spells: new Map<string, SpellDef>(),
    monsters: new Map<string, MonsterDef>(),
    invocations: new Map<string, InvocationDef>(),
    languages: new Map<string, LanguageDef>(),
    tools: new Map<string, ToolDef>(),
    weapons: new Map<string, WeaponDef>(),
    armors: new Map<string, ArmorDef>(),
    gear: new Map<string, GearDef>(),
    equipmentPacks: new Map<string, EquipmentPackDef>(),
    speciesOptionLabels: new Map<string, PackDisplayLabels>(),
    spellVariantLabels: {} as PackDisplayLabels,
  };
  for (const pack of packs) {
    const converted = pack.translations
      ? translateConverted(pack, cloneConverted(convertPack(pack)), overlay)
      : convertPack(pack);
    for (const { def, features } of converted.classes) {
      overlay.classes.set(def.id, def);
      overlay.classFeatures.set(def.id, features);
    }
    for (const { def, traits } of converted.species) {
      overlay.species.set(def.id, def);
      overlay.speciesTraits.set(def.id, traits);
    }
    for (const def of converted.backgrounds) overlay.backgrounds.set(def.id, def);
    for (const def of converted.subclasses) overlay.subclasses.set(def.id, def);
    for (const def of converted.feats) overlay.feats.set(def.id, def);
    for (const def of converted.spells) overlay.spells.set(def.id, def);
    for (const def of converted.monsters) overlay.monsters.set(def.id, def);
    for (const def of converted.invocations) overlay.invocations.set(def.id, def);
    for (const def of converted.languages) overlay.languages.set(def.id, def);
    for (const def of converted.tools) overlay.tools.set(def.id, def);
    for (const def of converted.weapons) overlay.weapons.set(def.id, def);
    for (const def of converted.armors) overlay.armors.set(def.id, def);
    for (const def of converted.gear) overlay.gear.set(def.id, def);
    for (const def of converted.equipmentPacks) overlay.equipmentPacks.set(def.id, def);
  }
  return overlay;
}

/**
 * Several copies of the same pack (a library version, the extract a sheet
 * keeps) folded into one per pack id: the first copy wins — its metadata and
 * its version of each entry — and later copies only add the entries it lacks.
 * Order the input from most to least authoritative.
 */
export function mergeContentPacks(packs: readonly ContentPack[]): ContentPack[] {
  const merged = new Map<string, ContentPack>();
  for (const pack of packs) {
    const current = merged.get(pack.id);
    if (!current) {
      merged.set(pack.id, pack);
      continue;
    }
    const content = { ...current.content };
    const translations = structuredCopy(current.translations);
    for (const kind of PACK_CONTENT_KINDS) {
      const have = new Set(current.content[kind].map((entry) => entry.id));
      const extra = (pack.content[kind] as { id: string }[]).filter((e) => !have.has(e.id));
      if (extra.length) {
        content[kind] = [...current.content[kind], ...extra] as never;
        // The added entries bring their translations along.
        for (const [code, translation] of Object.entries(pack.translations ?? {})) {
          const shadows = translation.content[kind];
          if (!shadows) continue;
          const target = (translations[code as keyof typeof translations] ??= { content: {} });
          const into = (target.content[kind] ??= {}) as Record<string, unknown>;
          for (const entry of extra) {
            if (shadows[entry.id]) into[entry.id] = shadows[entry.id];
          }
        }
      }
    }
    merged.set(pack.id, {
      ...current,
      content,
      translations: Object.keys(translations).length ? translations : undefined,
    });
  }
  return [...merged.values()];
}
