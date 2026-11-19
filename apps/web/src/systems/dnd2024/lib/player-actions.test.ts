import { describe, expect, it } from "vitest";

import {
  defaultSlot,
  searchSkills,
  slotOptions,
  spendSlot,
  type SkillRow,
} from "@/systems/dnd2024/lib/player-actions";

const rows: SkillRow[] = [
  { skill: "stealth", label: "Discrétion", ability: "DEX", modifier: 1, proficient: false },
  { skill: "athletics", label: "Athlétisme", ability: "FOR", modifier: 5, proficient: true },
  { skill: "history", label: "Histoire", ability: "INT", modifier: 0, proficient: false },
];

describe("searchSkills", () => {
  it("finds a skill without its accents, case-insensitive", () => {
    expect(searchSkills(rows, "disc").map((r) => r.skill)).toEqual(["stealth"]);
    expect(searchSkills(rows, "ATHLE").map((r) => r.skill)).toEqual(["athletics"]);
  });

  it("finds skills by their ability, and everything on an empty search", () => {
    expect(searchSkills(rows, "int").map((r) => r.skill)).toEqual(["history"]);
    expect(searchSkills(rows, "  ")).toHaveLength(3);
  });
});

describe("spell slots", () => {
  const wizard = { spellSlots: { 1: 4, 2: 3, 3: 2 }, pactMagic: null } as never;
  const warlock = { spellSlots: {}, pactMagic: { count: 2, level: 3 } } as never;

  it("offers every slot level at or above the spell's, with what is left", () => {
    const options = slotOptions(wizard, { "1": 4, "2": 1 }, 2);
    expect(options.map((o) => [o.key, o.left])).toEqual([
      ["2", 2],
      ["3", 2],
    ]);
    expect(slotOptions(wizard, {}, 0)).toEqual([]);
  });

  it("picks the lowest slot left, skipping a spent level", () => {
    const options = slotOptions(wizard, { "1": 4 }, 1);
    expect(defaultSlot(options)?.key).toBe("2");
    expect(defaultSlot(slotOptions(wizard, { "1": 4, "2": 3, "3": 2 }, 1))).toBeUndefined();
  });

  it("casts a warlock's spell with the pact, at the pact's level", () => {
    const [pact] = slotOptions(warlock, { pact: 1 }, 1);
    expect(pact).toMatchObject({ key: "pact", level: 3, pact: true, left: 1 });
    expect(spendSlot({ pact: 1 }, pact)).toEqual({ pact: 2 });
    expect(spendSlot({ pact: 2 }, pact)).toEqual({ pact: 2 });
  });
});
