import { z } from "zod";
import { localized } from "./locale";

/**
 * Every die shape used in 5e / 2024. `d1` is the degenerate "always 1" die,
 * kept only so flat-damage oddities (the blowgun's 1 piercing) fit the same
 * `DicePool` model as everything else.
 */
export const DICE = ["d1", "d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
export type Die = (typeof DICE)[number];
export const diceSchema = z.enum(DICE);

/** Dice a player normally picks from when defining an attack or a spell. */
export const COMMON_DICES: Die[] = ["d4", "d6", "d8", "d10", "d12"];

export const DICE_SIDES: Record<Die, number> = {
  d1: 1,
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export const DICE_LABELS: Record<Die, string> = localized({
  fr: {
    d1: "1 (fixe)",
    d4: "d4",
    d6: "d6",
    d8: "d8",
    d10: "d10",
    d12: "d12",
    d20: "d20",
    d100: "d100",
  },
  en: {
    d1: "1 (flat)",
    d4: "d4",
    d6: "d6",
    d8: "d8",
    d10: "d10",
    d12: "d12",
    d20: "d20",
    d100: "d100",
  },
});

/** A pool of identical dice, e.g. `2d6`. */
export const dicePoolSchema = z.object({
  count: z.number().int().min(1).max(100),
  die: diceSchema,
});
export type DicePool = z.infer<typeof dicePoolSchema>;

/**
 * Best-effort `DicePool` from a loose value:
 * - a well-formed pool → returned as-is
 * - a legacy string (`"1d8"`, `"3"`) → parsed (pre-`DicePool` weapon data
 *   stored `damageDice` / `versatileDice` as strings)
 * - a `{ count, sides: 8 }` / `{ die: 8 }` shape → coerced
 * - anything else → `null`
 */
export function coerceDicePool(value: unknown): DicePool | null {
  if (value == null) return null;
  if (typeof value === "string") return parseDicePool(value);
  if (typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.die === "string") {
    return DICE.includes(v.die as Die) && typeof v.count === "number" && v.count >= 1
      ? { count: Math.trunc(v.count), die: v.die as Die }
      : null;
  }
  const sides = typeof v.sides === "number" ? v.sides : typeof v.die === "number" ? v.die : null;
  if (sides == null) return null;
  const die = `d${sides}` as Die;
  const count = typeof v.count === "number" && v.count >= 1 ? Math.trunc(v.count) : 1;
  return DICE.includes(die) ? { count, die } : null;
}

/**
 * `{ count: 2, die: "d6" }` → `"2d6"` (a `d1` pool prints as the bare count).
 * Tolerates the legacy string / loose shapes via {@link coerceDicePool}; an
 * unrecognisable value yields `""` rather than leaking `"undefined"` into the UI.
 */
export function formatDicePool(pool: DicePool | string | null | undefined): string {
  const coerced = coerceDicePool(pool);
  if (!coerced) return "";
  return coerced.die === "d1" ? String(coerced.count) : `${coerced.count}${coerced.die}`;
}

/** Parse `"2d6"` / `"1d8"` / `"3"` → a pool, or `null` when unrecognised. */
export function parseDicePool(value: string): DicePool | null {
  const match = /^\s*(\d+)\s*(?:d\s*(\d+))?\s*$/i.exec(value);
  if (!match) return null;
  const count = Number(match[1]);
  if (!count) return null;
  if (!match[2]) return { count, die: "d1" };
  const die = `d${Number(match[2])}` as Die;
  return DICE.includes(die) ? { count, die } : null;
}

export function rollDicePool(pool: DicePool): { rolls: number[]; total: number } {
  const sides = DICE_SIDES[pool.die];
  const rolls = Array.from({ length: pool.count }, () => Math.floor(Math.random() * sides) + 1);
  return { rolls, total: rolls.reduce((sum, n) => sum + n, 0) };
}

/** Multiply a pool's dice count (critical hit, spell scaling…). */
export function scaleDicePool(pool: DicePool, factor: number): DicePool {
  return { count: Math.max(1, pool.count * factor), die: pool.die };
}
