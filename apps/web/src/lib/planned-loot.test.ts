import { describe, expect, it } from "vitest";

import { normalizePlannedLoot, plannedLootSources, plannedLootToGift } from "@/lib/planned-loot";

const NO_COINS = { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };

describe("normalizePlannedLoot", () => {
  it("drops blank lines and empty loot", () => {
    expect(normalizePlannedLoot({ items: [{ name: "  " }], money: { gold: 0 } })).toBeUndefined();
    expect(normalizePlannedLoot(undefined)).toBeUndefined();
  });

  it("trims names, defaults quantities and fills the coins", () => {
    expect(
      normalizePlannedLoot({
        items: [{ name: " Dague " }, { name: "Flèche", quantity: 3 }],
        money: { gold: 30 },
      }),
    ).toEqual({
      items: [
        { name: "Dague", quantity: 1 },
        { name: "Flèche", quantity: 3 },
      ],
      money: { ...NO_COINS, gold: 30 },
    });
  });
});

describe("plannedLootToGift", () => {
  it("makes inventory lines, a stack being consumable", () => {
    const gift = plannedLootToGift({
      items: [
        { name: "Dague", quantity: 1 },
        { name: "Flèche", quantity: 5 },
      ],
      money: { ...NO_COINS, gold: 30 },
    });
    expect(
      gift.items.map((e) => [e.section, e.item.name, e.item.quantity, e.item.consumable]),
    ).toEqual([
      ["inventory", "Dague", 1, false],
      ["inventory", "Flèche", 5, true],
    ]);
    expect(gift.items[0]!.item.id).not.toBe(gift.items[1]!.item.id);
    expect(gift.money.gold).toBe(30);
  });
});

describe("plannedLootSources", () => {
  const loot = { items: [{ name: "Dague", quantity: 1 }], money: NO_COINS };
  const enemies = [
    { id: "e1", name: "Chef gobelin", locationId: "l2", loot },
    { id: "e2", name: "Gobelin", locationId: "l1" },
    { id: "e3", name: "Ogre", loot },
    { id: "e4", name: "Rôdeur", locationId: "l1", loot },
  ];
  const locations = [
    { id: "l1", name: "Crypte", loot },
    { id: "l2", name: "Village" },
  ];

  it("takes the enemies in the fight or at the current place, then the place", () => {
    const sources = plannedLootSources({
      enemies,
      locations,
      combatants: [
        { kind: "enemy", refId: "e1" },
        { kind: "character", refId: "e3" },
      ],
      currentLocationId: "l1",
    });
    expect(sources.map((s) => [s.key, s.name])).toEqual([
      ["enemy:e1", "Chef gobelin"],
      ["enemy:e4", "Rôdeur"],
      ["location:l1", "Crypte"],
    ]);
  });

  it("offers nothing without loot", () => {
    expect(
      plannedLootSources({ enemies: [{ id: "x", name: "X" }], locations: [], combatants: [] }),
    ).toEqual([]);
  });
});
