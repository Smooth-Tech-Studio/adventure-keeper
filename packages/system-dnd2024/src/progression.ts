import { getClass } from "./classes";

/**
 * 5e 2024 character advancement — a single experience table shared by every
 * class (identical to the 2014 rules). Milestone / "level when the GM says so"
 * play is also supported: nothing here forces a level-up, it only *suggests*
 * one from the accumulated XP.
 */

/** Total XP required to reach each level. Index 0 = level 1 (0 XP). */
export const XP_THRESHOLDS: readonly number[] = [
  0, // 1
  300, // 2
  900, // 3
  2_700, // 4
  6_500, // 5
  14_000, // 6
  23_000, // 7
  34_000, // 8
  48_000, // 9
  64_000, // 10
  85_000, // 11
  100_000, // 12
  120_000, // 13
  140_000, // 14
  165_000, // 15
  195_000, // 16
  225_000, // 17
  265_000, // 18
  305_000, // 19
  355_000, // 20
];

export const MAX_LEVEL = 20;

/** Highest level whose XP threshold is met by `xp` (clamped to 1..20). */
export function levelForXp(xp: number): number {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i += 1) {
    if (safe >= XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Total XP needed to be at `level` (clamped to 1..20). */
export function xpForLevel(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return XP_THRESHOLDS[clamped - 1];
}

/** XP still needed to reach the next level, or `null` at level 20. */
export function xpToNextLevel(xp: number): number | null {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[level] - Math.max(0, Math.floor(xp));
}

// ===========================================================================
// Ability-score improvements
// ===========================================================================

/**
 * Levels at which a class gains « Amélioration de caractéristique » — raise one
 * ability by 2 or two by 1 (max 20), or take a feat instead.
 *
 * Most classes get it at 4 / 8 / 12 / 16. The Fighter gets two extra (6 and 14)
 * and the Rogue one (10); level 19 is the epic boon, handled separately.
 *
 * Follows the class tables on https://www.aidedd.org/regles-24/classes/.
 */
const DEFAULT_ASI_LEVELS: readonly number[] = [4, 8, 12, 16];

/** Level at which every 2024 class may take an epic boon in place of an increase. */
export const EPIC_BOON_LEVEL = 19;

/** The improvement levels of a class, ascending. */
export function asiLevels(classId: string): readonly number[] {
  return getClass(classId)?.asiLevels ?? DEFAULT_ASI_LEVELS;
}

/** Those already reached at `level`. */
export function asiLevelsUpTo(classId: string, level: number): number[] {
  return asiLevels(classId).filter((at) => at <= level);
}

/** How many improvements the character has earned so far. */
export function asiCount(classId: string, level: number): number {
  return asiLevelsUpTo(classId, level).length;
}
