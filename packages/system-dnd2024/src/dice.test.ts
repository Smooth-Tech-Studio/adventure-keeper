import { describe, expect, it } from "vitest";

import { coerceDicePool, formatDicePool, parseDicePool, scaleDicePool } from "./dice";
import { spellDamageAt, type SpellDef } from "./spells";

describe("dice pool", () => {
  it("formats and parses round-trip", () => {
    expect(formatDicePool({ count: 2, die: "d6" })).toBe("2d6");
    expect(formatDicePool({ count: 3, die: "d1" })).toBe("3");
    expect(parseDicePool("1d8")).toEqual({ count: 1, die: "d8" });
    expect(parseDicePool("2 d 10")).toEqual({ count: 2, die: "d10" });
    expect(parseDicePool("4")).toEqual({ count: 4, die: "d1" });
    expect(parseDicePool("1d7")).toBeNull();
    expect(parseDicePool("d6")).toBeNull();
  });

  it("scales the dice count only", () => {
    expect(scaleDicePool({ count: 3, die: "d6" }, 2)).toEqual({ count: 6, die: "d6" });
  });

  it("coerces legacy / loose shapes back to a pool", () => {
    expect(coerceDicePool({ count: 2, die: "d6" })).toEqual({ count: 2, die: "d6" });
    expect(coerceDicePool("1d8")).toEqual({ count: 1, die: "d8" }); // pre-DicePool weapon data
    expect(coerceDicePool("2")).toEqual({ count: 2, die: "d1" });
    expect(coerceDicePool({ count: 3, sides: 10 })).toEqual({ count: 3, die: "d10" });
    expect(coerceDicePool(null)).toBeNull();
    expect(coerceDicePool(undefined)).toBeNull();
    expect(coerceDicePool("garbage")).toBeNull();
    expect(coerceDicePool({ count: 1, die: "d7" })).toBeNull();
  });

  it("never leaks 'undefined' — legacy string in, formatted string out", () => {
    expect(formatDicePool("1d6" as unknown as never)).toBe("1d6");
    expect(formatDicePool(undefined)).toBe("");
    expect(formatDicePool(null)).toBe("");
    expect(formatDicePool({ count: 1 } as unknown as never)).toBe("");
  });
});

describe("spellDamageAt", () => {
  const firebolt = {
    level: 0,
    damage: {
      pool: { count: 1, die: "d10" as const },
      kind: "fire" as const,
      scaling: "cantrip" as const,
    },
  } satisfies Pick<SpellDef, "level" | "damage">;
  const fireball = {
    level: 3,
    damage: {
      pool: { count: 8, die: "d6" as const },
      kind: "fire" as const,
      scaling: "slot" as const,
    },
  } satisfies Pick<SpellDef, "level" | "damage">;

  it("scales a cantrip by character tier (5 / 11 / 17)", () => {
    expect(spellDamageAt(firebolt, { characterLevel: 1 })?.pool).toEqual({ count: 1, die: "d10" });
    expect(spellDamageAt(firebolt, { characterLevel: 5 })?.pool).toEqual({ count: 2, die: "d10" });
    expect(spellDamageAt(firebolt, { characterLevel: 11 })?.pool).toEqual({ count: 3, die: "d10" });
    expect(spellDamageAt(firebolt, { characterLevel: 17 })?.pool).toEqual({ count: 4, die: "d10" });
  });

  it("scales a leveled spell by slot level above its base", () => {
    expect(spellDamageAt(fireball, { slotLevel: 3 })?.pool).toEqual({ count: 8, die: "d6" });
    expect(spellDamageAt(fireball, { slotLevel: 5 })?.pool).toEqual({ count: 10, die: "d6" });
  });

  it("returns null when the spell rolls nothing", () => {
    expect(spellDamageAt({ level: 1 }, {})).toBeNull();
  });
});
