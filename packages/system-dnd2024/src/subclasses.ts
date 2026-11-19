/**
 * 5e 2024 subclasses.
 *
 * Every class picks a subclass at level 3 and gains its features at levels 3, 6,
 * 10 and 14. Names and features follow
 * https://www.aidedd.org/regles-24/classes/ ; every `summary` is a reminder in
 * our own words, never the rulebook's text.
 *
 * One subclass per class: the SRD 5.2.1 ones. Pack subclasses come through
 * `getSubclass` / `subclassesFor` like these.
 *
 * **Only the SRD 5.2.1 content lives here.** Everything else from the 2024
 * rules was moved out of the code on 8 October 2026 into a private content pack
 * (see `docs/CONTENT_PACKS.md`): a table that owns the book imports it and
 * shares it, the app does not ship it.
 *
 * Plain serialisable data, like `choices.ts` and `feats.ts`.
 */

import type { ChoiceDef } from "./choices";
import { getClass } from "./classes";
import { activeContent } from "./packs/active";
import type { FeatureRoll } from "./feature-rolls";
import type { FeatureUses } from "./features";
import type { Mechanic } from "./mechanics";
import { locale, pick, translateTree, type Shadow } from "./locale";
import type { PackSubclass } from "./packs/schema";
import SRD_SUBCLASSES from "./srd/subclasses.json";

/** A subclass feature — the shape the later batch will fill in. */
export interface SubclassFeatureDef {
  /**
   * Character level at which it is gained. Usually 3 / 6 / 10 / 14, but the
   * grid is not the same for every class — the cleric's fall on 3 / 6 / 17.
   */
  level: number;
  name: string;
  /** Short reminder in our own words. */
  summary: string;
  uses?: FeatureUses;
  /** What it changes on the sheet (see `mechanics.ts`). */
  mechanics?: Mechanic[];
  /** What using it rolls (see `feature-rolls.ts`). */
  roll?: FeatureRoll;
}

/** A spell a subclass keeps always prepared from `minLevel` (class level). */
export interface SubclassSpellGrant {
  spellId: string;
  minLevel: number;
  /** `0` for a cantrip. */
  spellLevel: number;
}

/**
 * Spell lists the player switches between — the Circle of the Land's four
 * environments, picked again at each long rest. Opens a choice
 * ({@link subclassSpellChoiceId}) whose values are the option names.
 */
export interface SubclassSpellVariants {
  label: string;
  hint?: string;
  options: { name: string; summary: string; spells: SubclassSpellGrant[] }[];
}

export interface SubclassDef {
  id: string;
  /** A `ClassId`, or `"pack:slug"` for a pack class. */
  classId: string;
  name: string;
  /** An illustration, hosted by the pack's author. */
  imageUrl?: string;
  /**
   * One line on what this subclass turns your character into, shown under its
   * name when you pick. Our words, never rulebook prose.
   */
  blurb: string;
  /** Gained at levels 3 / 6 / 10 / 14 — empty until the features batch lands. */
  features: SubclassFeatureDef[];
  /** Spells always prepared (domain, oath, patron…), by class level. */
  spells?: SubclassSpellGrant[];
  /** Or lists to choose from, when the subclass has several. */
  spellVariants?: SubclassSpellVariants;
}

/** Level at which every 2024 class chooses its subclass. */
export const SUBCLASS_LEVEL = 3;

/**
 * The SRD subclasses, read from `srd/subclasses.json` (the pack format). The
 * file holds the slug; the id is `<classId>:<slug>`, as sheets store it.
 */
export const SUBCLASSES: SubclassDef[] = (SRD_SUBCLASSES.entries as unknown as PackSubclass[]).map(
  (entry) => ({ ...entry, id: `${entry.classId}:${entry.id}` }),
);

/** The English of the SRD's spell lists — display labels: a sheet stores the French name. */
const SRD_VARIANT_LABELS: Record<string, string> = {};

{
  const english = SRD_SUBCLASSES.translations.en as Record<string, Record<string, Shadow>>;
  SUBCLASSES.forEach((subclass, index) => {
    const entry = SRD_SUBCLASSES.entries[index] as { id: string };
    const shadow = english[entry.id] as
      | (Record<string, Shadow> & {
          spellVariants?: { options?: { name?: string; summary?: string }[] };
        })
      | undefined;
    const variants = shadow?.spellVariants;
    variants?.options?.forEach((option, at) => {
      const name = subclass.spellVariants?.options[at]?.name;
      if (name && option.name) SRD_VARIANT_LABELS[name] = option.name;
    });
    // The stored name stays French; only its summary is translated in place.
    const own = variants
      ? {
          ...shadow,
          spellVariants: {
            ...variants,
            options: variants.options?.map(({ summary }) => (summary ? { summary } : {})),
          },
        }
      : shadow;
    translateTree(subclass, { en: own as Shadow });
  });
}

const BY_ID = new Map(SUBCLASSES.map((subclass) => [subclass.id, subclass]));

export function getSubclass(id: string): SubclassDef | undefined {
  return activeContent()?.subclasses.get(id) ?? BY_ID.get(id);
}

/** The subclasses a class can pick from — SRD first, then active packs. */
export function subclassesFor(classId: string): SubclassDef[] {
  const packs = activeContent()?.subclasses;
  const all = packs ? [...SUBCLASSES, ...packs.values()] : SUBCLASSES;
  return all.filter((subclass) => subclass.classId === classId);
}

/** What a class's subclass is called (« Voie », « Serment »…). */
export function subclassLabel(classId: string): string {
  return getClass(classId)?.subclassLabel ?? pick({ fr: "Sous-classe", en: "Subclass" });
}

/** `true` when this subclass's features are documented (see the module note). */
export function subclassIsDetailed(id: string): boolean {
  return (getSubclass(id)?.features.length ?? 0) > 0;
}

/** `true` once the character is high enough level to have a subclass. */
export function hasSubclass(level: number): boolean {
  return level >= SUBCLASS_LEVEL;
}

/**
 * The subclass pick, as a choice — opened at level 3. Returns `undefined` for an
 * unknown class.
 */
export function subclassChoice(classId: string): ChoiceDef | undefined {
  const subclasses = subclassesFor(classId);
  if (subclasses.length === 0) return undefined;
  return {
    id: `class:${classId}:subclass`,
    source: "class",
    kind: "option",
    label: subclassLabel(classId),
    count: 1,
    pool: { kind: "list", values: subclasses.map((subclass) => subclass.id) },
    minLevel: SUBCLASS_LEVEL,
  };
}

/**
 * The features a subclass grants up to `level` — empty for now, kept so callers
 * are already written against the final shape.
 */
export function subclassFeatures(subclassId: string, level: number): SubclassFeatureDef[] {
  return (getSubclass(subclassId)?.features ?? []).filter((feature) => feature.level <= level);
}

/** The pick between a subclass's spell lists — see {@link SubclassSpellVariants}. */
export function subclassSpellChoiceId(classId: string): string {
  return `class:${classId}:subclass-spells`;
}

/** That pick, opened once the subclass is taken; `undefined` when it has a single list. */
export function subclassSpellChoice(classId: string, subclassId: string): ChoiceDef | undefined {
  const variants = getSubclass(subclassId)?.spellVariants;
  if (!variants) return undefined;
  return {
    id: subclassSpellChoiceId(classId),
    source: "class",
    kind: "option",
    label: variants.label,
    count: 1,
    pool: { kind: "list", values: variants.options.map((option) => option.name) },
    minLevel: SUBCLASS_LEVEL,
    requires: { choiceId: `class:${classId}:subclass`, value: subclassId },
    ...(variants.hint ? { hint: variants.hint } : {}),
  };
}

/**
 * How one of those lists reads in the engine's locale — the list itself (what
 * a sheet stores) is always its French name; a pack's is shown as written.
 */
export function subclassSpellVariantLabel(name: string): string {
  const packLabel = activeContent()?.spellVariantLabels[locale()]?.[name];
  if (packLabel) return packLabel;
  return locale() === "fr" ? name : (SRD_VARIANT_LABELS[name] ?? name);
}

/** What one of those lists holds, in a line — the picker's gloss. */
export function subclassSpellVariantSummary(classId: string, name: string): string | undefined {
  for (const subclass of subclassesFor(classId)) {
    const option = subclass.spellVariants?.options.find((entry) => entry.name === name);
    if (option) return option.summary;
  }
  return undefined;
}

/** The spells a subclass keeps prepared at `level` — from the variant picked, if it has several. */
export function subclassSpellGrants(
  subclassId: string,
  level: number,
  variant?: string,
): SubclassSpellGrant[] {
  const subclass = getSubclass(subclassId);
  if (!subclass) return [];
  const list =
    subclass.spells ??
    subclass.spellVariants?.options.find((option) => option.name === variant)?.spells ??
    [];
  return list.filter((grant) => level >= grant.minLevel);
}
