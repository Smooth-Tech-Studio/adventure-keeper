import type { Ability } from "./abilities";
import { CLASSES, getClass, type ClassId } from "./classes";

/**
 * 5e 2024 spellcasting limits per class and character level. Numbers follow the
 * class tables on https://www.aidedd.org/regles-24/classes/ (colonnes « Sorts
 * mineurs » et « Sorts préparés »). Arrays are indexed by `level - 1`.
 */
/** The classes that cast spells, in the order of the class list. */
export const SPELLCASTING_CLASSES: ClassId[] = CLASSES.filter((klass) => klass.spellcasting).map(
  (klass) => klass.id as ClassId,
);

export function isSpellcaster(classId: string): boolean {
  return getClass(classId)?.spellcasting !== undefined;
}

function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.round(level)));
}

export function cantripsKnown(classId: string, level: number): number {
  const table = getClass(classId)?.cantripsKnown;
  return table ? table[clampLevel(level) - 1] : 0;
}

export function preparedSpellsCount(classId: string, level: number): number {
  const table = getClass(classId)?.preparedSpells;
  return table ? table[clampLevel(level) - 1] : 0;
}

/** Highest spell level (1-9) the class can cast at this character level. */
export function maxSpellLevel(classId: string, level: number): number {
  const lvl = clampLevel(level);
  switch (getClass(classId)?.spellcasting) {
    case "half":
      return Math.min(5, Math.ceil(lvl / 4));
    case "pact":
      return Math.min(5, Math.floor((lvl + 1) / 2));
    case "full":
      return Math.min(9, Math.floor((lvl + 1) / 2));
    default:
      return 0;
  }
}

// --- Spellcasting ability -------------------------------------------------

/** The ability score a class casts with (`null` for non-casters). */
export function spellcastingAbility(classId: string): Ability | null {
  return getClass(classId)?.spellcastingAbility ?? null;
}

// --- Spell slots -------------------------------------------------------
//
// Standard 2024 tables. Rows indexed by `level - 1`.
//   - full casters: bard / cleric / druid / sorcerer / wizard  → [L1..L9]
//   - half casters: paladin / ranger (cast from level 1 in 2024) → [L1..L5]
//   - warlock: Pact Magic (a few slots of a single level, short-rest recovery)

const FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

const PACT_MAGIC: { count: number; level: number }[] = [
  { count: 1, level: 1 },
  { count: 2, level: 1 },
  { count: 2, level: 2 },
  { count: 2, level: 2 },
  { count: 2, level: 3 },
  { count: 2, level: 3 },
  { count: 2, level: 4 },
  { count: 2, level: 4 },
  { count: 2, level: 5 },
  { count: 2, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 3, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
  { count: 4, level: 5 },
];

export interface SpellSlotInfo {
  /** Spell level (1-9) → number of slots. Only entries greater than 0. */
  slots: Record<number, number>;
  /** Warlock Pact Magic, or `null`. */
  pact: { count: number; level: number } | null;
}

/** Max spell slots (and Pact Magic) a class has at a character level. */
export function spellSlotsFor(classId: string, level: number): SpellSlotInfo {
  const lvl = clampLevel(level);
  const progression = getClass(classId)?.spellcasting;

  if (progression === "pact") {
    const pact = PACT_MAGIC[lvl - 1];
    return { slots: {}, pact: pact.count > 0 ? { ...pact } : null };
  }

  const table =
    progression === "full" ? FULL_CASTER_SLOTS : progression === "half" ? HALF_CASTER_SLOTS : null;
  if (!table) return { slots: {}, pact: null };

  const slots: Record<number, number> = {};
  table[lvl - 1].forEach((count, index) => {
    if (count > 0) slots[index + 1] = count;
  });
  return { slots, pact: null };
}
