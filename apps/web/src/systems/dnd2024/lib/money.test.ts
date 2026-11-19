import { describe, expect, it } from "vitest";
import { ZERO_MONEY } from "@adventure-keeper/schemas";
import {
  addCoins,
  canAfford,
  credit,
  debit,
  formatPurse,
  fromCopper,
  goldToCopper,
  missingCopper,
  spendCoins,
  toCopper,
} from "./money";

describe("toCopper", () => {
  it("weighs every coin", () => {
    expect(toCopper({ platinum: 1 })).toBe(1000);
    expect(toCopper({ gold: 1 })).toBe(100);
    expect(toCopper({ electrum: 1 })).toBe(50);
    expect(toCopper({ silver: 1 })).toBe(10);
    expect(toCopper({ copper: 1 })).toBe(1);
  });

  it("is 0 for an empty or missing purse", () => {
    expect(toCopper()).toBe(0);
    expect(toCopper(null)).toBe(0);
    expect(toCopper(ZERO_MONEY)).toBe(0);
  });

  it("adds a mixed purse up", () => {
    // 2 pp + 15 po + 1 pe + 3 pa + 7 pc
    expect(toCopper({ platinum: 2, gold: 15, electrum: 1, silver: 3, copper: 7 })).toBe(3587);
  });
});

describe("fromCopper", () => {
  it("splits largest first, and makes neither platinum nor electrum", () => {
    expect(fromCopper(3587)).toEqual({
      platinum: 0,
      gold: 35,
      electrum: 0,
      silver: 8,
      copper: 7,
    });
  });

  it("leaves a class's starting gold alone rather than making platinum", () => {
    // The Cleric's « 110 po » option must read as 110 gold, not 11 platinum.
    expect(fromCopper(goldToCopper(110))).toMatchObject({ platinum: 0, gold: 110 });
    expect(fromCopper(goldToCopper(25))).toMatchObject({ platinum: 0, gold: 25 });
  });

  it("clamps a negative amount to an empty purse", () => {
    expect(fromCopper(-500)).toEqual(ZERO_MONEY);
  });

  it("round-trips any amount", () => {
    for (const amount of [0, 1, 9, 10, 99, 100, 999, 1000, 12345]) {
      expect(toCopper(fromCopper(amount))).toBe(amount);
    }
  });
});

describe("formatPurse", () => {
  it("leaves out the coins the purse does not hold", () => {
    expect(formatPurse(fromCopper(goldToCopper(110)))).toBe("110 po");
    expect(formatPurse({ gold: 15, silver: 3 })).toBe("15 po · 3 pa");
  });

  it("still shows a platinum coin the player typed in by hand", () => {
    expect(formatPurse({ platinum: 2, gold: 5 })).toBe("2 pp · 5 po");
  });

  it("reads « 0 po » when empty, so the line never vanishes", () => {
    expect(formatPurse(null)).toBe("0 po");
  });
});

describe("canAfford", () => {
  it("compares the whole purse, not a single coin", () => {
    // 50 silver is 500 cp, enough for a 4 gp item.
    expect(canAfford({ silver: 50 }, 400)).toBe(true);
    expect(canAfford({ silver: 50 }, 600)).toBe(false);
    expect(canAfford({ gold: 5 }, 500)).toBe(true);
    expect(canAfford(null, 0)).toBe(true);
  });
});

describe("debit / credit", () => {
  it("makes change across coins", () => {
    // 1 po − 3 pc = 9 pa 7 pc
    expect(debit({ gold: 1 }, 3)).toEqual({
      platinum: 0,
      gold: 0,
      electrum: 0,
      silver: 9,
      copper: 7,
    });
  });

  it("empties the purse rather than refusing — the shop warns instead", () => {
    expect(debit({ gold: 1 }, 5000)).toEqual(ZERO_MONEY);
  });

  it("credits and is the inverse of a debit it can cover", () => {
    const purse = { ...ZERO_MONEY, gold: 10 };
    expect(toCopper(credit(purse, 250))).toBe(1250);
    expect(toCopper(debit(credit(purse, 250), 250))).toBe(toCopper(purse));
  });

  it("converts electrum away once touched", () => {
    // 2 pe = 100 cp = 1 po.
    expect(credit({ electrum: 2 }, 0)).toEqual({ ...ZERO_MONEY, gold: 1 });
  });
});

describe("goldToCopper", () => {
  it("quotes a starting package's gold in copper", () => {
    expect(goldToCopper(155)).toBe(15500);
    expect(goldToCopper(0)).toBe(0);
  });
});

describe("addCoins / spendCoins — a sum at the table", () => {
  const purse = { ...ZERO_MONEY, gold: 12, silver: 4 };

  it("adds coin by coin, without melting anything", () => {
    expect(addCoins(purse, { gold: 50, silver: 5 })).toEqual({
      ...ZERO_MONEY,
      gold: 62,
      silver: 9,
    });
    expect(addCoins(purse, { platinum: 1 }).platinum).toBe(1);
  });

  it("spends the coins held", () => {
    expect(spendCoins(purse, { gold: 2, silver: 1 })).toEqual({
      ...ZERO_MONEY,
      gold: 10,
      silver: 3,
    });
  });

  it("makes change from the smallest bigger coin", () => {
    // 5 pa with no pa to spare: 1 po breaks into 10 pa.
    const noSilver = { ...ZERO_MONEY, gold: 12 };
    expect(spendCoins(noSilver, { silver: 5 })).toEqual({ ...ZERO_MONEY, gold: 11, silver: 5 });
    // The electrum breaks before the gold.
    const withElectrum = { ...ZERO_MONEY, gold: 1, electrum: 1 };
    expect(spendCoins(withElectrum, { silver: 2 })).toEqual({
      ...ZERO_MONEY,
      gold: 1,
      silver: 3,
    });
  });

  it("pays with smaller coins when no bigger one is left", () => {
    expect(spendCoins({ ...ZERO_MONEY, silver: 30 }, { gold: 2 })).toEqual({
      ...ZERO_MONEY,
      silver: 10,
    });
  });

  it("refuses a sum the purse does not cover, and says what is missing", () => {
    expect(spendCoins(purse, { gold: 13 })).toBeNull();
    expect(missingCopper(purse, { gold: 13 })).toBe(60);
    expect(missingCopper(purse, { gold: 1 })).toBe(0);
  });
});
