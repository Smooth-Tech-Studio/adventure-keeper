/**
 * What using a feature rolls, and what the total gives: HP back (Second
 * souffle, Plénitude physique, Métabolisme surnaturel) or temporary HP
 * (Défense patiente). The dice may be the monk's Martial Arts die, read at the
 * character's level.
 */

import type { Ability } from "./abilities";
import { martialArtsDie } from "./classes";
import { formatDicePool, scaleDicePool, type DicePool } from "./dice";

export interface FeatureRoll {
  /** A fixed pool, or so many of the monk's Martial Arts die. */
  dice: DicePool | { martialArts: number };
  /** Added to the dice: the class level or an ability modifier. */
  bonus?: "level" | Ability;
  gives: "hp" | "tempHp";
  /** A roll named apart from its feature (Défense patiente, in Credo accru). */
  label?: string;
  /** The feature whose pool it spends one point of (the Credo), by id. */
  spends?: string;
}

export interface FeatureRollContext {
  classId: string;
  level: number;
  abilityModifiers: Record<Ability, number>;
}

/** The dice and the flat bonus of a feature's roll, at the character's level. */
export function featureRollDice(
  roll: FeatureRoll,
  ctx: FeatureRollContext,
): { pool: DicePool; bonus: number } {
  const pool =
    "die" in roll.dice
      ? roll.dice
      : scaleDicePool(
          martialArtsDie(ctx.classId, ctx.level) ?? { count: 1, die: "d6" },
          roll.dice.martialArts,
        );
  const bonus =
    roll.bonus === undefined
      ? 0
      : roll.bonus === "level"
        ? ctx.level
        : ctx.abilityModifiers[roll.bonus];
  return { pool, bonus };
}

/** « 1d8 + 3 », « 2d8 »: what a feature's roll is, to read on the sheet. */
export function formatFeatureRoll(roll: FeatureRoll, ctx: FeatureRollContext): string {
  const { pool, bonus } = featureRollDice(roll, ctx);
  const dice = formatDicePool(pool);
  return bonus === 0 ? dice : `${dice} ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)}`;
}
