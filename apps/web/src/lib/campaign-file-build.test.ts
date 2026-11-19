import { describe, expect, it } from "vitest";
import { parseAdventureFile } from "@adventure-keeper/schemas";

import { fileAdventureOf, type AdventureContent } from "@/lib/campaign-file-build";

const base = { campaignId: "c", adventureId: "a", createdAt: 0, updatedAt: 0 } as const;

const content = {
  title: "L'entrée",
  summary: "",
  locations: [
    { ...base, id: "l2", name: "La crypte", hidden: true, order: 1 },
    { ...base, id: "l1", name: "Le portail", description: "Des runes.", hidden: false, order: 0 },
  ],
  enemies: [
    {
      ...base,
      name: "Gobelin",
      armorClass: 15,
      maxHitPoints: 7,
      speed: 9,
      attacks: [],
      locationId: "l2",
    },
  ],
  npcs: [{ ...base, name: "Anselme", locationId: "l1", order: 0 }],
  events: [{ ...base, title: "L'embuscade", isRevealed: true, revealedSessionId: "s1", order: 0 }],
} as unknown as AdventureContent;

describe("fileAdventureOf", () => {
  it("writes locations in order and by name, without what play added", () => {
    const adventure = fileAdventureOf(content);
    expect(adventure).toEqual({
      title: "L'entrée",
      locations: [
        { name: "Le portail", description: "Des runes." },
        { name: "La crypte", hidden: true },
      ],
      enemies: [
        { name: "Gobelin", armorClass: 15, maxHitPoints: 7, speed: 9, location: "La crypte" },
      ],
      npcs: [{ name: "Anselme", location: "Le portail" }],
      events: [{ title: "L'embuscade" }],
    });
    // A valid adventure file, as the import reads it.
    expect(parseAdventureFile(JSON.stringify({ format: "ak-adventure/1", adventure })).ok).toBe(
      true,
    );
  });
});

describe("fileAdventureOf — planned loot", () => {
  const money = { platinum: 0, gold: 30, electrum: 0, silver: 0, copper: 0 };
  const noMoney = { ...money, gold: 0 };
  const foe = { ...base, armorClass: 15, maxHitPoints: 7, speed: 9, attacks: [] };
  const withLoot = {
    ...content,
    locations: [
      {
        ...base,
        id: "l1",
        name: "La crypte",
        order: 0,
        hidden: false,
        loot: { items: [{ name: "Clé", quantity: 1 }], money: noMoney },
      },
    ],
    enemies: [
      { ...foe, name: "Chef gobelin", loot: { items: [{ name: "Dague", quantity: 2 }], money } },
      { ...foe, name: "Gobelin", loot: { items: [], money: noMoney } },
    ],
  } as unknown as AdventureContent;

  it("writes only what is held, and the file is valid", () => {
    const adventure = fileAdventureOf(withLoot);
    expect(adventure.locations[0]).toEqual({
      name: "La crypte",
      loot: { items: [{ name: "Clé" }] },
    });
    expect(adventure.enemies[0]!.loot).toEqual({
      items: [{ name: "Dague", quantity: 2 }],
      money: { gold: 30 },
    });
    expect(adventure.enemies[1]!.loot).toBeUndefined();
    expect(parseAdventureFile(JSON.stringify({ format: "ak-adventure/1", adventure })).ok).toBe(
      true,
    );
  });
});
