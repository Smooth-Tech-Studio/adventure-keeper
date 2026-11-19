/** Dice helpers. `Math.random`-based — not cryptographic, fine for tabletop. */

/** Roll one die with `sides` faces (1..sides). */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll 1d20. */
export function d20(): number {
  return rollDie(20);
}

/**
 * Roll a dice expression like `"2d6"`, `"1d8"` or `"d4"` (an optional flat `+N`
 * is ignored — pass bonuses separately). Returns each die plus their total.
 */
export function rollDiceExpr(expr: string): { rolls: number[]; total: number } {
  const match = /(\d*)d(\d+)/i.exec(expr.trim());
  if (!match) return { rolls: [], total: 0 };
  const count = Math.max(1, Number(match[1] || "1"));
  const sides = Number(match[2]);
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  return { rolls, total: rolls.reduce((sum, n) => sum + n, 0) };
}
