import { ZERO_MONEY, type Money } from "@adventure-keeper/schemas";
import { COIN_ABBR, COIN_LABELS, COINS as COIN_IDS } from "@adventure-keeper/system-dnd2024";

/**
 * The five coins, highest value first (1 pp = 10 po = 20 pe = 100 pa = 1000 pc),
 * named in the interface language.
 */
export const COINS: { key: keyof Money; label: string; short: string }[] = COIN_IDS.map((key) => ({
  key,
  get label() {
    return COIN_LABELS[key];
  },
  get short() {
    return COIN_ABBR[key];
  },
}));

/** A purse with every coin filled in — sheets saved before `platinum` / `electrum` lack them. */
export function normalizeMoney(money?: Partial<Money> | null): Money {
  return { ...ZERO_MONEY, ...money };
}

/**
 * A purse with the empty coins left out: `15 po · 3 pa`. Since {@link fromCopper}
 * stops at gold, spelling out every coin would carry a « 0 pp » and a « 0 pe »
 * that can never be anything else. An empty purse still reads « 0 po », so the
 * line never disappears.
 */
export function formatPurse(money?: Partial<Money> | null): string {
  const purse = normalizeMoney(money);
  const held = COINS.filter(({ key }) => purse[key] > 0);
  if (held.length === 0) return `0 ${COIN_ABBR.gold}`;
  return held.map(({ key, short }) => `${purse[key]} ${short}`).join(" · ");
}

// ===========================================================================
// Arithmetic — everything goes through copper
// ===========================================================================

/** What one of each coin is worth in copper (1 pp = 10 po = 20 pe = 100 pa = 1000 pc). */
export const COIN_VALUE_CP: Record<keyof Money, number> = {
  platinum: 1000,
  gold: 100,
  electrum: 50,
  silver: 10,
  copper: 1,
};

/** A purse's total worth, in copper. */
export function toCopper(money?: Partial<Money> | null): number {
  const purse = normalizeMoney(money);
  return COINS.reduce((total, { key }) => total + purse[key] * COIN_VALUE_CP[key], 0);
}

/**
 * Copper split back into coins, largest first — **gold is the biggest coin this
 * makes**. Platinum and electrum are coins you *receive*, not ones you would
 * choose to make change with: a class that hands you 110 po should read
 * « 110 po », not « 11 pp ». So a purse that went through here holds
 * po / pa / pc only.
 *
 * Platinum and electrum a purse already holds are still counted by
 * {@link toCopper}, so nothing is lost in value — but spending melts them down
 * into gold, because every amount comes back through here.
 */
export function fromCopper(copper: number): Money {
  let left = Math.max(0, Math.round(copper));
  const out = { ...ZERO_MONEY };
  for (const key of ["gold", "silver", "copper"] as const) {
    const value = COIN_VALUE_CP[key];
    out[key] = Math.floor(left / value);
    left -= out[key] * value;
  }
  return out;
}

/** `true` when the purse covers `priceCp`. */
export function canAfford(money: Partial<Money> | null | undefined, priceCp: number): boolean {
  return toCopper(money) >= Math.max(0, Math.round(priceCp));
}

/**
 * Spends `priceCp`, making change across the coins. Going past what the purse
 * holds is **allowed** and leaves it empty — the shop warns rather than blocks,
 * so the GM can let a player start in debt.
 */
export function debit(money: Partial<Money> | null | undefined, priceCp: number): Money {
  return fromCopper(toCopper(money) - Math.max(0, Math.round(priceCp)));
}

/** Adds `amountCp` to the purse. */
export function credit(money: Partial<Money> | null | undefined, amountCp: number): Money {
  return fromCopper(toCopper(money) + Math.max(0, Math.round(amountCp)));
}

/** Gold pieces as copper — starting-equipment packages are quoted in gold. */
export function goldToCopper(gold: number): number {
  return Math.round(gold) * COIN_VALUE_CP.gold;
}

// ===========================================================================
// Coin by coin — a sum added or spent at the table
// ===========================================================================

/** Lowest coin first: change is made upward. */
const ASCENDING = ["copper", "silver", "electrum", "gold", "platinum"] as const;

/** Adds a sum coin by coin: the coins received are kept as they are. */
export function addCoins(
  money: Partial<Money> | null | undefined,
  amount: Partial<Money> | null | undefined,
): Money {
  const purse = normalizeMoney(money);
  const sum = normalizeMoney(amount);
  return Object.fromEntries(
    COINS.map(({ key }) => [key, purse[key] + Math.max(0, Math.round(sum[key]))]),
  ) as Money;
}

/**
 * Spends a sum coin by coin, making change: a coin the purse lacks breaks the
 * smallest bigger coin it holds (1 po → 10 pa), and without one the smaller
 * coins pay. `null` when the whole purse does not cover the sum — the table
 * then says what is missing ({@link missingCopper}).
 */
export function spendCoins(
  money: Partial<Money> | null | undefined,
  amount: Partial<Money> | null | undefined,
): Money | null {
  const cost = normalizeMoney(amount);
  if (toCopper(money) < toCopper(cost)) return null;
  const purse = normalizeMoney(money);

  for (const [index, coin] of ASCENDING.entries()) {
    let need = Math.max(0, Math.round(cost[coin]));
    const take = () => {
      const used = Math.min(purse[coin], need);
      purse[coin] -= used;
      need -= used;
    };
    take();
    // Break the smallest bigger coin held, as long as some is missing.
    for (const bigger of ASCENDING.slice(index + 1)) {
      while (need > 0 && purse[bigger] > 0) {
        purse[bigger] -= 1;
        purse[coin] += COIN_VALUE_CP[bigger] / COIN_VALUE_CP[coin];
        take();
      }
    }
    if (need === 0) continue;
    // No bigger coin left: the smaller ones pay, the largest first.
    let owed = need * COIN_VALUE_CP[coin];
    for (const smaller of ASCENDING.slice(0, index).reverse()) {
      const used = Math.min(purse[smaller], Math.floor(owed / COIN_VALUE_CP[smaller]));
      purse[smaller] -= used;
      owed -= used * COIN_VALUE_CP[smaller];
    }
    // The coins left cannot make the exact sum: count it all in copper instead.
    if (owed > 0) return fromCopper(toCopper(money) - toCopper(cost));
  }
  return purse;
}

/** What a purse lacks to cover a sum, in copper (0 when it covers it). */
export function missingCopper(
  money: Partial<Money> | null | undefined,
  amount: Partial<Money> | null | undefined,
): number {
  return Math.max(0, toCopper(amount) - toCopper(money));
}
