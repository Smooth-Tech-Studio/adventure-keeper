import { SRD_CLASS_FEATURES } from "./classes";
import { SRD_SPECIES_TRAITS, getLineage, getSpecies, speciesOptionLabel } from "./species";
import { activeContent } from "./packs/active";
import type { FeatureRoll } from "./feature-rolls";
import type { Amount, Mechanic } from "./mechanics";
import { pick } from "./locale";

/**
 * Class & species features for 5e 2024 — **base class chassis only** (the
 * aptitudes every member of the class gets, whatever their subclass). Subclass
 * features, feats and background origin feats are not listed here.
 *
 * Every `summary` is a short reminder written in our own words (mechanics, not
 * flavour) — no rulebook prose is reproduced. Levels and scaling follow the 2024
 * rules; treat the summaries as memory joggers, not rules text.
 */

export interface FeatureUses {
  /**
   * Uses before a recharge: a number, `"prof"` (the proficiency bonus),
   * `"level"`, an ability modifier, a multiple of the level (a pool of points:
   * Imposition des mains) or a value that grows with the level.
   */
  max: Amount;
  recharge: "short" | "long";
  /** From this level, a long-rest feature comes back on a short rest too. */
  shortFrom?: number;
}

export interface ClassFeatureDef {
  id: string;
  /** A `ClassId`, or `"pack:slug"` for a pack class. */
  classId: string;
  /** Character level at which the feature is gained. */
  level: number;
  name: string;
  summary: string;
  uses?: FeatureUses;
  /** What it changes on the sheet (see `mechanics.ts`). */
  mechanics?: Mechanic[];
  /** What using it rolls (see `feature-rolls.ts`). */
  roll?: FeatureRoll;
}

export interface SpeciesFeatureDef {
  id: string;
  /** A `SpeciesId`, or `"pack:slug"` for a pack species. */
  speciesId: string;
  name: string;
  summary: string;
  uses?: FeatureUses;
  mechanics?: Mechanic[];
  roll?: FeatureRoll;
}

/** The SRD's class features, read with their classes from `srd/classes.json`. */
export const CLASS_FEATURES: ClassFeatureDef[] = SRD_CLASS_FEATURES;

/** Base-class features gained at or below `level`, in level order, in the current locale. */
export function classFeatures(classId: string, level: number): ClassFeatureDef[] {
  const all = activeContent()?.classFeatures.get(classId) ?? CLASS_FEATURES;
  return all
    .filter((feature) => feature.classId === classId && feature.level <= level)
    .sort((a, b) => a.level - b.level)
    .map((feature) => ({ ...feature }));
}

// ===========================================================================
// Species
// ===========================================================================

/** The SRD's species traits, read with their species from `srd/species.json`. */
export const SPECIES_FEATURES: SpeciesFeatureDef[] = SRD_SPECIES_TRAITS;

export function speciesFeatures(speciesId: string): SpeciesFeatureDef[] {
  return (
    activeContent()?.speciesTraits.get(speciesId) ??
    SPECIES_FEATURES.filter((f) => f.speciesId === speciesId).map((trait) => ({ ...trait }))
  );
}

/**
 * A character's species traits. Once the lineage is picked, the trait that
 * tells every lineage tells only the chosen one; a pack species, whose traits
 * we cannot match, gets the lineage as a trait of its own.
 */
export function speciesTraitsFor(speciesId: string, choice?: string): SpeciesFeatureDef[] {
  const traits = speciesFeatures(speciesId);
  const species = getSpecies(speciesId);
  const lineage = getLineage(speciesId, choice);
  if (!choice || !lineage || !species?.choice) return traits;
  const chosen = {
    name: `${species.choice.label}${pick({ fr: " : ", en: ": " })}${speciesOptionLabel(speciesId, choice)}`,
    summary: lineage.summary,
  };
  const generic = `${speciesId}:${species.lineageTrait}`;
  return traits.some((trait) => trait.id === generic)
    ? traits.map((trait) => (trait.id === generic ? { ...trait, ...chosen } : trait))
    : [...traits, { id: `${speciesId}:lineage`, speciesId, ...chosen }];
}
