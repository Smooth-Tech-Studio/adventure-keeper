import { z } from "zod";
import { rollDicePool } from "./dice";
import { compareLabels, localized, localizedList } from "./locale";

/**
 * 5e 2024 ability scores. Keys are the short forms used everywhere in the app;
 * `ABILITY_LABELS` holds the display names, in the engine's locale.
 */
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const abilitySchema = z.enum(ABILITIES);

export const ABILITY_LABELS: Record<Ability, string> = localized({
  fr: {
    str: "Force",
    dex: "Dextérité",
    con: "Constitution",
    int: "Intelligence",
    wis: "Sagesse",
    cha: "Charisme",
  },
  en: {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",
  },
});

/** Abilities sorted alphabetically by their label (engine locale) — for pickers and lists. */
export const ABILITIES_BY_LABEL: Ability[] = localizedList(() =>
  [...ABILITIES].sort((a, b) => compareLabels(ABILITY_LABELS[a], ABILITY_LABELS[b])),
);

/**
 * What each ability actually governs, in one line. The creation table is six
 * rows of numbers; without this, a newcomer has no way to tell which of them
 * matters for the character they have in mind. Our words, never rulebook prose.
 */
export const ABILITY_SUMMARY: Record<Ability, string> = localized({
  fr: {
    str: "Soulever, pousser, frapper au corps à corps : la puissance physique brute.",
    dex: "Viser, esquiver, se faufiler, garder l'équilibre — et l'initiative au combat.",
    con: "L'endurance : vos points de vie, et votre résistance au poison comme à l'épuisement.",
    int: "La mémoire et le raisonnement : savoirs, déductions, et la magie du magicien.",
    wis: "L'attention et le discernement : remarquer, comprendre, et la magie du clerc ou du druide.",
    cha: "La force de la personnalité : convaincre, mentir, mener — et la magie du barde, de l'ensorceleur ou de l'occultiste.",
  },
  en: {
    str: "Lifting, pushing, hitting in melee: raw physical power.",
    dex: "Aiming, dodging, slipping through, keeping your balance — and initiative in combat.",
    con: "Stamina: your hit points, and how well you resist poison and exhaustion.",
    int: "Memory and reasoning: knowledge, deduction, and the wizard's magic.",
    wis: "Awareness and judgement: noticing, understanding, and the magic of clerics and druids.",
    cha: "Force of personality: convincing, lying, leading — and the magic of bards, sorcerers and warlocks.",
  },
});

export const ABILITY_ABBR: Record<Ability, string> = localized({
  fr: {
    str: "FOR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "SAG",
    cha: "CHA",
  },
  en: {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
  },
});

/** A full set of ability scores (1–30). */
export const abilityScoreBlockSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});
export type AbilityScoreBlock = z.infer<typeof abilityScoreBlockSchema>;

/** Ability modifiers (can be negative). */
export const abilityModifierBlockSchema = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});
export type AbilityModifierBlock = z.infer<typeof abilityModifierBlockSchema>;

/**
 * Allocation of the 2024 background ability bonuses: `+2` to one ability and
 * `+1` to another, or `+1` to three (see `isValidBackgroundBonusPattern`).
 */
export const abilityBonusBlockSchema = z.object({
  str: z.number().int().min(0).max(2),
  dex: z.number().int().min(0).max(2),
  con: z.number().int().min(0).max(2),
  int: z.number().int().min(0).max(2),
  wis: z.number().int().min(0).max(2),
  cha: z.number().int().min(0).max(2),
});
export type AbilityBonusBlock = z.infer<typeof abilityBonusBlockSchema>;

export const ZERO_BONUSES: AbilityBonusBlock = {
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0,
};

/** `floor((score - 10) / 2)`. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// --- Point buy -------------------------------------------------------------

export const POINT_BUY_BUDGET = 27;

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Point-buy cost of a single score, or `null` if outside the 8–15 buy range. */
export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

export interface PointBuyResult {
  total: number;
  allScoresInRange: boolean;
  withinBudget: boolean;
}

export function evaluatePointBuy(scores: AbilityScoreBlock): PointBuyResult {
  let total = 0;
  let allScoresInRange = true;
  for (const ability of ABILITIES) {
    const cost = pointBuyCost(scores[ability]);
    if (cost === null) {
      allScoresInRange = false;
    } else {
      total += cost;
    }
  }
  return {
    total,
    allScoresInRange,
    withinBudget: allScoresInRange && total <= POINT_BUY_BUDGET,
  };
}

/** The 2024 "standard array". */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

// --- Block helpers -------------------------------------------------------------

export function addBlocks(base: AbilityScoreBlock, bonus: AbilityBonusBlock): AbilityScoreBlock {
  return {
    str: base.str + bonus.str,
    dex: base.dex + bonus.dex,
    con: base.con + bonus.con,
    int: base.int + bonus.int,
    wis: base.wis + bonus.wis,
    cha: base.cha + bonus.cha,
  };
}

export function modifierBlock(scores: AbilityScoreBlock): AbilityModifierBlock {
  return {
    str: abilityModifier(scores.str),
    dex: abilityModifier(scores.dex),
    con: abilityModifier(scores.con),
    int: abilityModifier(scores.int),
    wis: abilityModifier(scores.wis),
    cha: abilityModifier(scores.cha),
  };
}

/** Proficiency bonus for a given character level (2024 = 5e progression). */
export function proficiencyBonus(level = 1): number {
  return Math.ceil(level / 4) + 1;
}

// ===========================================================================
// Generating a set of scores
// ===========================================================================

/**
 * The three ways the 2024 rules offer to produce the six base scores, plus the
 * free entry an existing sheet or a house rule needs.
 */
export const ABILITY_METHODS = ["standardArray", "pointBuy", "roll", "manual"] as const;
export type AbilityMethod = (typeof ABILITY_METHODS)[number];

export const ABILITY_METHOD_LABELS: Record<AbilityMethod, string> = localized({
  fr: {
    standardArray: "Tableau standard",
    pointBuy: "Achat de points",
    roll: "Lancers de dés",
    manual: "Saisie libre",
  },
  en: {
    standardArray: "Standard array",
    pointBuy: "Point buy",
    roll: "Dice rolls",
    manual: "Free entry",
  },
});

/** `true` when the method hands out a fixed set of values to assign. */
export function methodAssignsFromPool(method: AbilityMethod): boolean {
  return method === "standardArray" || method === "roll";
}

/** One rolled score: 4d6, the lowest die dropped. */
export interface RolledAbilityScore {
  /** The four dice, as rolled. */
  rolls: number[];
  /** Index in `rolls` of the die that was dropped. */
  droppedIndex: number;
  /** Sum of the three kept dice. */
  total: number;
}

/**
 * Rolls one ability score the usual way: 4d6, keep the best three. Only the
 * *first* lowest die is dropped, so the result reads correctly when several
 * dice tie.
 */
export function rollAbilityScore(): RolledAbilityScore {
  const { rolls } = rollDicePool({ count: 4, die: "d6" });
  let droppedIndex = 0;
  for (let i = 1; i < rolls.length; i += 1) {
    if (rolls[i] < rolls[droppedIndex]) droppedIndex = i;
  }
  const total = rolls.reduce(
    (sum, value, index) => (index === droppedIndex ? sum : sum + value),
    0,
  );
  return { rolls, droppedIndex, total };
}
