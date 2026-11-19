import { z } from "zod";
import type { Ability } from "./abilities";
import type { DicePool } from "./dice";
import type { DamageKind } from "./spells";
import type { Skill } from "./skills";
import { activeContent } from "./packs/active";
import { locale, localized, translateTree, type Shadow } from "./locale";
import type { SpeciesFeatureDef } from "./features";
import SRD_SPECIES from "./srd/species.json";

export const CREATURE_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];
export const creatureSizeSchema = z.enum(CREATURE_SIZES);

/** Carrying capacity per size, relative to a Medium creature. */
const CARRYING_FACTOR: Record<CreatureSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
};

/**
 * Carrying capacity: Strength × 15 lb, i.e. 7.5 kg, scaled by size. Beyond it a
 * creature can only drag, lift or push, up to twice that weight.
 */
export function carryingCapacityKg(strength: number, size: CreatureSize): number {
  return strength * 7.5 * CARRYING_FACTOR[size];
}

/** The size category one step up (Gargantuan stays Gargantuan). */
export function largerSize(size: CreatureSize): CreatureSize {
  return CREATURE_SIZES[Math.min(CREATURE_SIZES.indexOf(size) + 1, CREATURE_SIZES.length - 1)];
}

/** « Forte carrure »: one size larger for the carrying capacity. */
export function hasPowerfulBuild(speciesId: string | undefined): boolean {
  return speciesId ? getSpecies(speciesId)?.powerfulBuild === true : false;
}

export const CREATURE_SIZE_LABELS: Record<CreatureSize, string> = localized({
  fr: {
    tiny: "TP (très petite)",
    small: "P (petite)",
    medium: "M (moyenne)",
    large: "G (grande)",
    huge: "TG (très grande)",
    gargantuan: "Gig (gigantesque)",
  },
  en: {
    tiny: "T (Tiny)",
    small: "S (Small)",
    medium: "M (Medium)",
    large: "L (Large)",
    huge: "H (Huge)",
    gargantuan: "G (Gargantuan)",
  },
});

/** Short form of a size, as written on a stat block. */
export const CREATURE_SIZE_ABBR: Record<CreatureSize, string> = localized({
  fr: {
    tiny: "TP",
    small: "P",
    medium: "M",
    large: "G",
    huge: "TG",
    gargantuan: "Gig",
  },
  en: {
    tiny: "T",
    small: "S",
    medium: "M",
    large: "L",
    huge: "H",
    gargantuan: "G",
  },
});

/**
 * A skill proficiency a species trait grants the player (they pick from a list,
 * or from every skill when `from === "any"`).
 */
export interface SpeciesSkillGrant {
  /** Trait that grants it — used as the UI label. */
  trait: string;
  /** How many skills the player chooses. */
  count: number;
  /** Skills to choose from; `"any"` = all 18 skills. */
  from: readonly Skill[] | "any";
}

/**
 * 5e 2024 species. In the 2024 rules a species grants **no ability score
 * increase** (those come from the background); it defines size, speed,
 * darkvision and an optional in-species choice (lineage / ancestry / legacy).
 *
 * Trait names are **not** repeated here: `SPECIES_FEATURES` in `features.ts`
 * carries the same names *plus* a summary for each, and `speciesFeatures(id)`
 * is what the UI reads. A few species also
 * grant a skill proficiency (`skillGrant`), the only trait with a computed
 * mechanical effect so far.
 */
/**
 * A species area attack resolved by a saving throw (the Dragonborn's Breath
 * Weapon). The DC uses the character's Constitution modifier + proficiency
 * bonus; the damage type comes from the ancestry choice; usable a number of
 * times per long rest equal to the proficiency bonus.
 */
export interface BreathWeaponDef {
  name: string;
  save: "dex";
  onSuccess: "half";
  /** Base dice; a die is added at character levels 5, 11 and 17. */
  baseDice: DicePool;
  /** Area, in our words. */
  shapes: string;
}

/** Abilities the spells a species grants may be cast with (the player picks one). */
export const SPECIES_SPELL_ABILITIES = ["int", "wis", "cha"] as const satisfies readonly Ability[];
export const speciesSpellAbilitySchema = z.enum(SPECIES_SPELL_ABILITIES);
export type SpeciesSpellAbility = (typeof SPECIES_SPELL_ABILITIES)[number];

/** A spell a lineage / legacy grants, gained at `minLevel` (cantrip: `spellLevel` 0). */
export interface LineageSpellGrant {
  /** Spell id, as found in the web app's `spells.json`. */
  spellId: string;
  /** Character level at which the spell is gained. */
  minLevel: number;
  /** `0` for a cantrip, `>= 1` for a spell cast once per long rest. */
  spellLevel: number;
}

/**
 * What a species choice (elven lineage, fiendish legacy…) changes on the sheet.
 * Everything is optional: only the numbers the sheet actually derives are here.
 */
export interface LineageDef {
  /** Walking speed replacing the species base (ft). */
  speed?: number;
  /** Darkvision range replacing the species base (ft). */
  darkvision?: number;
  /** Damage types the character resists. */
  resistances?: DamageKind[];
  /** Spells granted (cantrip at level 1, then at levels 3 and 5). */
  spells?: LineageSpellGrant[];
  /** The damage type of the species' breath weapon (the Dragonborn's ancestry). */
  breathDamage?: DamageKind;
  /** Short reminder shown next to the species traits (our words). */
  summary: string;
}

export interface SpeciesDef {
  /** A `SpeciesId` for the SRD; `"pack:slug"` for a pack species. */
  id: string;
  name: string;
  /** An illustration, hosted by the pack's author. */
  imageUrl?: string;
  /**
   * One line on what this species brings, shown on the creation card above the
   * size and the speed. Our words, never rulebook prose.
   */
  blurb: string;
  /** A single size, or a choice between two. */
  size: CreatureSize | CreatureSize[];
  /** Walking speed in feet. */
  speed: number;
  /** Darkvision range in feet; `0` = none. */
  darkvision: number;
  /** Player choice made within the species. */
  choice?: { label: string; options: string[] };
  /** Effects of each `choice` option on the sheet, keyed by option name. */
  lineages?: Record<string, LineageDef>;
  /**
   * The ability the lineage / legacy spells are cast with is the player's pick
   * (Intelligence, Wisdom or Charisma) — `true` when the species has spells.
   */
  spellsUseChosenAbility?: boolean;
  /** Spells the species grants whatever the choice (Tieffelin « Thaumaturgie »). */
  spells?: LineageSpellGrant[];
  /** Label of the trait that grants `spells` (shown as the source on the sheet). */
  spellsTrait?: string;
  /** Damage types the species resists whatever the choice (Nain, Aasimar). */
  resistances?: DamageKind[];
  /** Extra hit points per character level (Nain « Ténacité naine »). */
  hitPointsPerLevel?: number;
  /** Skill proficiency granted by a trait (Elf, Human), if any. */
  skillGrant?: SpeciesSkillGrant;
  /**
   * An Origin feat the species lets the player pick (Human « Polyvalent »).
   * Only the trait's name lives here: the pool is every Origin feat, and
   * `resolveChoices` builds it — so this module stays free of `feats.ts`.
   */
  originFeatGrant?: { trait: string };
  /** A saving-throw area attack the species grants (Dragonborn). */
  breathWeapon?: BreathWeaponDef;
  /** Languages the species grants, on top of the base ones. */
  languages?: string[];
  /** « Forte carrure »: one size larger for the carrying capacity (Goliath). */
  powerfulBuild?: boolean;
  /**
   * The trait that tells every option of the choice (« Lignage elfique »): once
   * an option is picked, the sheet shows that option in its place.
   */
  lineageTrait?: string;
}

export const SPECIES_IDS = [
  "dragonborn",
  "dwarf",
  "elf",
  "gnome",
  "goliath",
  "halfling",
  "human",
  "orc",
  "tiefling",
] as const;
export const speciesIdSchema = z.enum(SPECIES_IDS);
export type SpeciesId = (typeof SPECIES_IDS)[number];

/** A species trait as the pack format writes it (`traits`). */
type TraitEntry = Omit<SpeciesFeatureDef, "id" | "speciesId">;

const SRD_ENTRIES = SRD_SPECIES.entries as unknown as (SpeciesDef & { traits: TraitEntry[] })[];

/** The SRD species, read from `srd/species.json` — their texts follow the locale. */
export const SPECIES: SpeciesDef[] = SRD_ENTRIES.map(({ traits: _traits, ...species }) => species);

/** Their traits: `features.ts` reads them (`speciesFeatures`). */
export const SRD_SPECIES_TRAITS: SpeciesFeatureDef[] = SRD_ENTRIES.flatMap((species) =>
  species.traits.map((trait) => ({
    ...trait,
    id: `${species.id}:${trait.name}`,
    speciesId: species.id,
  })),
);

/** The English of a species option, by species — a display label: sheets store the French. */
const SRD_OPTION_LABELS: Record<string, Record<string, string>> = {};

{
  type SpeciesShadow = Record<string, Shadow> & {
    choice?: { label?: string; options?: string[] };
    traits?: Shadow[];
  };
  const english = SRD_SPECIES.translations.en as Record<string, SpeciesShadow>;
  SPECIES.forEach((species) => {
    const { traits, choice, ...own } = english[species.id] ?? {};
    choice?.options?.forEach((label, index) => {
      const option = species.choice?.options[index];
      if (option) (SRD_OPTION_LABELS[species.id] ??= {})[option] = label;
    });
    // The options stay French: only the choice's label is translated in place.
    translateTree(species, { en: { ...own, choice: { label: choice?.label } } as Shadow });
    SRD_SPECIES_TRAITS.filter((trait) => trait.speciesId === species.id).forEach((trait, index) =>
      translateTree(trait, { en: traits?.[index] }),
    );
  });
}

export function getSpecies(id: string): SpeciesDef | undefined {
  return activeContent()?.species.get(id) ?? SPECIES.find((species) => species.id === id);
}

/** The SRD species, then those of the active content packs. */
export function allSpecies(): SpeciesDef[] {
  const packs = activeContent()?.species;
  return packs ? [...SPECIES, ...packs.values()] : SPECIES;
}

/** Sizes the species may be: one (fixed) or two (the player picks). Empty for an unknown species. */
export function speciesSizes(speciesId: string): CreatureSize[] {
  const size = getSpecies(speciesId)?.size;
  return size === undefined ? [] : Array.isArray(size) ? size : [size];
}

/** `true` when the player gets to pick the size (Aasimar, Humain, Tieffelin). */
export function speciesHasSizeChoice(speciesId: string): boolean {
  return speciesSizes(speciesId).length > 1;
}

/**
 * The size a character is: the one picked when the species allows it, else the
 * species' own (Medium when it offers a choice and none was made). `undefined`
 * only for an unknown species.
 */
export function speciesSize(speciesId: string, chosen?: string): CreatureSize | undefined {
  const sizes = speciesSizes(speciesId);
  const picked = sizes.find((size) => size === chosen);
  if (picked) return picked;
  return sizes.includes("medium") ? "medium" : sizes[0];
}

/** The effects of the species choice the player made, or `undefined`. */
/**
 * Lineage names we used to store, mapped to the rulebook's. Renaming a lineage
 * renames a **stored value** — a sheet saved as « Elfe des bois » would stop
 * resolving — so the old spelling keeps working on read, for ever. New sheets
 * only ever store the names in `choice.options`.
 */
const LINEAGE_ALIASES: Record<string, string> = {
  "Elfe des bois": "Elfe sylvestre",
  Chthonien: "Chtonien",
};

/** The name a stored lineage goes by today — see {@link LINEAGE_ALIASES}. */
export function canonicalLineage(choice?: string): string | undefined {
  if (!choice) return undefined;
  return LINEAGE_ALIASES[choice] ?? choice;
}

/**
 * How a species option (lineage, ancestry, legacy) reads in the engine's
 * locale. The option itself — what a sheet stores — is always the French
 * name; a pack's options are shown as written.
 */
export function speciesOptionLabel(speciesId: string, option: string): string {
  const name = canonicalLineage(option) ?? option;
  const packLabel = activeContent()?.speciesOptionLabels.get(speciesId)?.[locale()]?.[name];
  if (packLabel) return packLabel;
  if (locale() === "fr") return name;
  return SRD_OPTION_LABELS[speciesId]?.[name] ?? name;
}

export function getLineage(speciesId: string, choice?: string): LineageDef | undefined {
  const name = canonicalLineage(choice);
  return name ? getSpecies(speciesId)?.lineages?.[name] : undefined;
}

/** Walking speed (ft): the lineage's, else the species base. */
export function speciesSpeed(speciesId: string, choice?: string): number | undefined {
  return getLineage(speciesId, choice)?.speed ?? getSpecies(speciesId)?.speed;
}

/** Darkvision range (ft): the lineage's, else the species base (`0` = none). */
export function speciesDarkvision(speciesId: string, choice?: string): number {
  return getLineage(speciesId, choice)?.darkvision ?? getSpecies(speciesId)?.darkvision ?? 0;
}

/**
 * Damage types the character resists thanks to its species: fixed ones (Nain,
 * Aasimar), the Dragonborn's ancestry, and the Tieffelin's legacy.
 */
export function speciesResistances(speciesId: string, choice?: string): DamageKind[] {
  const species = getSpecies(speciesId);
  if (!species) return [];
  const out: DamageKind[] = [...(species.resistances ?? [])];
  out.push(...(getLineage(speciesId, choice)?.resistances ?? []));
  return [...new Set(out)];
}

/** `true` when the species (whatever the choice) grants spells cast with a chosen ability. */
export function speciesHasSpells(speciesId: string): boolean {
  return getSpecies(speciesId)?.spellsUseChosenAbility === true;
}
