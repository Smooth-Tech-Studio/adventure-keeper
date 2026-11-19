import { describe, expect, it } from "vitest";

import { mergeBelongings, seedBelongings, splitBelongings } from "./character-belongings";

const DELETED = Symbol("deleteField");
const purse = { platinum: 0, gold: 12, electrum: 0, silver: 3, copper: 0 };

describe("splitBelongings", () => {
  it("moves the private fields of a 5e sheet to the belongings", () => {
    const { main, belongings } = splitBelongings(
      {
        name: "Thorin",
        weapons: [{ name: "Hache" }],
        inventory: [{ name: "Corde" }],
        money: purse,
        experiencePoints: 300,
      },
      DELETED,
    );
    expect(main).toEqual({
      name: "Thorin",
      weapons: [{ name: "Hache" }],
      inventory: DELETED,
      money: DELETED,
      experiencePoints: DELETED,
      notes: DELETED,
    });
    expect(belongings).toEqual({
      inventory: [{ name: "Corde" }],
      money: purse,
      experiencePoints: 300,
    });
  });

  it("takes a standard sheet's notes out too", () => {
    const { belongings } = splitBelongings(
      { system: "standard", notes: "Doit 10 po à Garrick." },
      DELETED,
    );
    expect(belongings).toEqual({ notes: "Doit 10 po à Garrick." });
  });

  it("clears a field set to undefined, and leaves alone one left out", () => {
    const { belongings } = splitBelongings({ notes: undefined, inventory: [] }, DELETED);
    expect(belongings).toEqual({ notes: DELETED, inventory: [] });
  });

  it("purges the old copies from the main doc even when the write leaves them out", () => {
    const { main, belongings } = splitBelongings({ name: "Thorin" }, DELETED);
    expect(main.inventory).toBe(DELETED);
    expect(main.experiencePoints).toBe(DELETED);
    expect(belongings).toEqual({});
  });
});

describe("seedBelongings", () => {
  const legacy = {
    name: "Thorin",
    inventory: [{ name: "Corde" }],
    money: purse,
    experiencePoints: 50,
  };

  it("keeps the old copies a write leaves out — an XP the form does not send", () => {
    expect(seedBelongings(legacy, { name: "Thorin", inventory: [] }, DELETED)).toEqual({
      inventory: [],
      money: purse,
      experiencePoints: 50,
    });
  });

  it("drops what the write clears", () => {
    const seeded = seedBelongings(
      { notes: "ancien" },
      { notes: DELETED, experiencePoints: undefined },
      DELETED,
    );
    expect(seeded).toEqual({});
  });

  it("starts empty for a new sheet", () => {
    expect(seedBelongings({}, { name: "Mira", money: purse }, undefined)).toEqual({ money: purse });
  });
});

describe("mergeBelongings", () => {
  const main = { id: "thorin", name: "Thorin", weapons: [] };

  it("puts the belongings back on the sheet", () => {
    expect(mergeBelongings(main, { inventory: [], money: purse, experiencePoints: 300 })).toEqual({
      ...main,
      inventory: [],
      money: purse,
      experiencePoints: 300,
    });
  });

  it("keeps an old sheet's own fields when there is no belongings doc", () => {
    const legacy = { ...main, inventory: [{ name: "Corde" }], experiencePoints: 50 };
    expect(mergeBelongings(legacy, null)).toBe(legacy);
  });

  it("lets the belongings win over a stale copy on the main doc", () => {
    const stale = { ...main, experiencePoints: 50, notes: "ancien" };
    expect(mergeBelongings(stale, { experiencePoints: 300 })).toEqual({
      ...main,
      experiencePoints: 300,
    });
  });
});
