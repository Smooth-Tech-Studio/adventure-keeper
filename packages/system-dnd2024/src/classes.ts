import { z } from "zod";
import type { Ability, AbilityScoreBlock } from "./abilities";
import type { ArmorCategory } from "./armors";
import type { Die, DicePool } from "./dice";
import type { Skill } from "./skills";
import type { ToolChoiceGroup } from "./tools";
import type { WeaponProficiencyGrant } from "./weapons";
import { localized, translateTree, type Shadow } from "./locale";
import { goldOnly, type EquipmentRefKind } from "./equipment-options";
import type { ClassFeatureDef } from "./features";
import type { ClassOptionDef } from "./class-options";
import type { PackClass } from "./packs/schema";
import SRD_CLASSES from "./srd/classes.json";
import type { StartingEquipmentDef } from "./equipment-options";
import { activeContent } from "./packs/active";

/**
 * 5e 2024 classes. Only the numbers the character-creation form needs are
 * modelled: hit die, primary ability, saving-throw proficiencies, a set of
 * suggested starting scores (standard-array assignment used to prefill the
 * form), the class skill choice, and the starting armour / weapon / tool
 * training.
 */
export interface ClassDef {
  /** A `ClassId` for the SRD, `"pack:slug"` for a class from a content pack. */
  id: string;
  name: string;
  /**
   * One line telling a player what this class *feels* like to play, shown on
   * the creation card above the numbers. Our words, never rulebook prose.
   */
  blurb: string;
  hitDie: 6 | 8 | 10 | 12;
  /**
   * How much the class asks of a new player, as the 2024 rules rate it
   * (« Aperçu des classes ») — the creation guide's « prise en main » filter.
   */
  complexity: ClassComplexity;
  primaryAbility: Ability[];
  savingThrows: [Ability, Ability];
  suggestedScores: AbilityScoreBlock;
  skillChoices: { count: number; from: Skill[] };
  /** Armour categories the class is trained in. */
  armorTraining: ArmorCategory[];
  /**
   * Which weapons the class is proficient with. In 5e 2024 the class is the
   * **only** source of weapon proficiency — species and backgrounds grant none —
   * so there is deliberately no weapon field on `SpeciesDef` / `BackgroundDef`.
   */
  weaponProficiency: WeaponProficiencyGrant;
  /** Tool proficiencies granted outright (catalogue ids). */
  toolProficiencies: string[];
  /** A tool proficiency the player picks from a group. */
  toolChoice?: { count: number; from: ToolChoiceGroup };

  // --- What the class turns on in the engine ---------------------------------
  // A mechanic that is a whole subsystem (spell slots, Wild Shape, invocations…)
  // lives in the engine; the class says that it uses it, and with which numbers.
  // The engine never tests a class by its name.

  /**
   * How the class's spell slots grow: one spell level every two character
   * levels (`full`), every four (`half`), or Pact Magic (`pact`). Absent: the
   * class casts no spells.
   */
  spellcasting?: "full" | "half" | "pact";
  /** How many skills get Expertise, by level reached. */
  expertise?: readonly LevelCount[];
  /** How many tool proficiencies the class can turn into Expertise. */
  toolExpertise?: number;
  /** The Martial Arts die, by level reached. */
  martialArts?: readonly { level: number; die: Die }[];
  /** The level at which the class gains Wild Shape. */
  wildShapeFrom?: number;
  /** Eldritch invocations known at each level, 1 → 20. */
  invocationsKnown?: readonly number[];
  /** One more skill from the class list, at a level (the Barbarian's Savoir primal). */
  bonusSkill?: { id: string; minLevel: number; label: string; hint: string };

  // --- Tables a pack class carries ---------------------------------------------
  // The SRD keeps these in tables indexed by class id (`spellcasting.ts`,
  // `languages.ts`…); a class from a pack carries them, and every lookup reads
  // the class first.

  /** An illustration, hosted by the pack's author. */
  imageUrl?: string;
  /** The ability the class casts with. */
  spellcastingAbility?: Ability;
  /** Cantrips known at each level, 1 → 20. */
  cantripsKnown?: readonly number[];
  /** Spells prepared at each level, 1 → 20. */
  preparedSpells?: readonly number[];
  /** Weapon Mastery slots, by level reached. */
  weaponMastery?: readonly LevelCount[];
  /** The levels of the Ability Score Improvement feat (4, 8, 12, 16 by default). */
  asiLevels?: readonly number[];
  /** The level of the Fighting Style feat. */
  fightingStyleLevel?: number;
  /** Languages the class grants: `LanguageId`s, or `"pack:slug"` for a pack language. */
  languages?: readonly string[];
  /** Languages the class lets the player pick, on top of the origin's. */
  languagePicks?: number;
  /** What its subclass is called (« Voie », « Serment »…). */
  subclassLabel?: string;
  /** Spells the class always has prepared, from a level; `label` names the source (its feature). */
  grantedSpells?: readonly {
    spellId: string;
    minLevel: number;
    spellLevel: number;
    label?: string;
  }[];
  /** The « au choix » of the class table (Ordre primitif…), see `class-options.ts`. */
  options?: readonly { slug: string; level: number; label: string; options: ClassOptionDef[] }[];
  /** Its starting equipment (the « gold only » option included). */
  startingEquipment?: StartingEquipmentDef;
}

/** A number that steps up with the level: the last step reached counts. */
export interface LevelCount {
  level: number;
  count: number;
}

export type ClassComplexity = "low" | "average" | "high";

export const CLASS_COMPLEXITY_LABELS: Record<ClassComplexity, string> = localized({
  fr: {
    low: "Simple",
    average: "Intermédiaire",
    high: "Exigeante",
  },
  en: {
    low: "Simple",
    average: "Intermediate",
    high: "Demanding",
  },
});

export const CLASS_IDS = [
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
] as const;
export const classIdSchema = z.enum(CLASS_IDS);
export type ClassId = (typeof CLASS_IDS)[number];

/**
 * A class written in the pack format (`packs/schema.ts`): the SRD's own,
 * read from `srd/classes.json`, or a content pack's. Ids and references are
 * resolved by the caller — the SRD keeps its short ids, a pack namespaces
 * them.
 */
export function classFromEntry(
  entry: PackClass,
  id: string,
  ref: {
    tool: (ref: string) => string;
    spell: (ref: string) => string;
    /** A kit line's item, by catalogue (`"weapon"`, `"gear"`…). */
    item?: (kind: EquipmentRefKind, ref: string) => string;
  } = {
    tool: (value) => value,
    spell: (value) => value,
  },
): { def: ClassDef; features: ClassFeatureDef[] } {
  const { features, spells, startingEquipment, toolProficiencies, options, ...rest } = entry;
  // A package's own picks are the class's: `class:<id>:<slug>`.
  const ownChoice = (slug: string) => `class:${id}:${slug}`;
  const def: ClassDef = {
    ...rest,
    id,
    toolProficiencies: toolProficiencies.map(ref.tool),
    ...(spells && {
      grantedSpells: spells.map((grant) => ({ ...grant, spellId: ref.spell(grant.spellId) })),
    }),
    ...(startingEquipment && {
      startingEquipment: {
        id: `class:${id}`,
        options: startingEquipment.options.map((option) =>
          option.label === undefined
            ? goldOnly(option.id, option.gold)
            : {
                id: option.id,
                label: option.label,
                gold: option.gold,
                items: (option.items ?? []).map(({ fromChoice, ...item }) =>
                  fromChoice
                    ? { ...item, fromChoice: ownChoice(fromChoice) }
                    : item.id
                      ? {
                          ...item,
                          id:
                            item.kind === "tool"
                              ? ref.tool(item.id)
                              : (ref.item?.(item.kind, item.id) ?? item.id),
                        }
                      : item,
                ),
                ...(option.choices && {
                  choices: option.choices.map((choice) => ({
                    ...choice,
                    id: ownChoice(choice.id),
                    source: "class" as const,
                  })),
                }),
              },
        ),
      },
    }),
    ...(options && {
      options: options.map((choice) => ({
        ...choice,
        options: choice.options.map((option) => ({ ...option, mechanics: option.mechanics ?? [] })),
      })),
    }),
  };
  return {
    def,
    features: features.map((feature) => ({
      ...feature,
      classId: id,
      id: `${id}:${feature.level}:${feature.name}`,
    })),
  };
}

const SRD = (SRD_CLASSES.entries as unknown as PackClass[]).map((entry) =>
  classFromEntry(entry, entry.id),
);

/** The SRD classes, read from `srd/classes.json` — their texts follow the locale. */
export const CLASSES: ClassDef[] = SRD.map(({ def }) => def);

/** The SRD classes' features, in class order. */
export const SRD_CLASS_FEATURES: ClassFeatureDef[] = SRD.flatMap(({ features }) => features);

{
  const english = SRD_CLASSES.translations.en as Record<string, Shadow>;
  SRD.forEach(({ def, features }) => {
    const shadow = english[def.id] as { features?: Shadow[]; spells?: Shadow } | undefined;
    // The file says `spells`, the class `grantedSpells`.
    const { spells, ...own } = shadow ?? {};
    translateTree(def, { en: { ...own, grantedSpells: spells } as Shadow });
    features.forEach((feature, index) => translateTree(feature, { en: shadow?.features?.[index] }));
  });
}

export function getClass(id: string): ClassDef | undefined {
  return activeContent()?.classes.get(id) ?? CLASSES.find((klass) => klass.id === id);
}

/** The SRD classes, then those of the active packs. */
export function allClasses(): ClassDef[] {
  const packs = activeContent()?.classes;
  return packs ? [...CLASSES, ...packs.values()] : CLASSES;
}

/** How many Weapon Mastery properties the class can use at `level` (0 if none). */
export function weaponMasteryCount(classId: string, level = 1): number {
  return countAt(getClass(classId)?.weaponMastery, level);
}

/** The count of the last step reached at `level` (0 before the first). */
function countAt(steps: readonly LevelCount[] | undefined, level: number): number {
  let count = 0;
  for (const step of steps ?? []) {
    if (level >= step.level) count = step.count;
  }
  return count;
}

/** How many skills get Expertise at `level` (0 for a class without the feature). */
export function skillExpertiseCount(classId: string, level = 1): number {
  return countAt(getClass(classId)?.expertise, level);
}

/** How many tool proficiencies the class can turn into Expertise. */
export function toolExpertiseCount(classId: string): number {
  return getClass(classId)?.toolExpertise ?? 0;
}

/** Whether the class learns Eldritch Invocations. */
export function hasInvocations(classId: string): boolean {
  return getClass(classId)?.invocationsKnown !== undefined;
}

/** How many invocations the class knows at this level (`0` for a class without any). */
export function invocationsKnown(classId: string, level: number): number {
  const table = getClass(classId)?.invocationsKnown;
  if (!table) return 0;
  const lvl = Math.min(table.length, Math.max(1, Math.round(level)));
  return table[lvl - 1] ?? 0;
}

/** `true` once the class has Wild Shape. */
export function hasWildShape(classId: string, level: number): boolean {
  const from = getClass(classId)?.wildShapeFrom;
  return from !== undefined && level >= from;
}

/**
 * The Martial Arts die by character level (the Monk's, 2024: d6, then d8 at 5,
 * d10 at 11, d12 at 17). `null` for a class without Martial Arts.
 */
export function martialArtsDie(classId: string, level = 1): DicePool | null {
  const steps = getClass(classId)?.martialArts;
  if (!steps) return null;
  const lvl = Math.max(1, Math.round(level));
  let die: Die | null = null;
  for (const step of steps) {
    if (lvl >= step.level) die = step.die;
  }
  return die ? { count: 1, die } : null;
}
