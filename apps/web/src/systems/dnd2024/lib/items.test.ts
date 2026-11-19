import { describe, expect, it } from "vitest";
import {
  cleanItems,
  draftFromArmorDef,
  draftFromWeaponDef,
  normalizeItem,
  normalizeItems,
  parseEquipmentLine,
  toItemDraft,
  withArmorEquipped,
} from "./items";
import type { ArmorDef, WeaponDef } from "@adventure-keeper/system-dnd2024";

describe("parseEquipmentLine", () => {
  it("reads a `Name ×N` line as a consumable stack", () => {
    const item = parseEquipmentLine("Torche ×5");
    expect(item).toMatchObject({ name: "Torche", consumable: true, quantity: 5 });
  });

  it("accepts a lowercase `x` too", () => {
    expect(parseEquipmentLine("Ration x3")).toMatchObject({ quantity: 3, consumable: true });
  });

  it("treats a bare name as a unique item", () => {
    expect(parseEquipmentLine("Épée longue")).toMatchObject({
      name: "Épée longue",
      consumable: false,
      quantity: 1,
    });
  });
});

describe("normalizeItem", () => {
  it("promotes a legacy string", () => {
    expect(normalizeItem("Potion ×2")).toMatchObject({ name: "Potion", quantity: 2 });
  });

  it("infers consumable from a quantity > 1 on legacy data", () => {
    expect(normalizeItem({ id: "x", name: "Flèches", quantity: 20 })).toMatchObject({
      consumable: true,
      quantity: 20,
    });
  });

  it("forces quantity 1 for a non-consumable", () => {
    expect(
      normalizeItem({ id: "x", name: "Bouclier", consumable: false, quantity: 7 }),
    ).toMatchObject({ consumable: false, quantity: 1 });
  });

  it("normalizeItems returns [] for non-arrays", () => {
    expect(normalizeItems(undefined)).toEqual([]);
    expect(normalizeItems("nope")).toEqual([]);
  });

  it("repairs a pre-DicePool weapon block (string dice → pool)", () => {
    const legacy = {
      id: "w",
      name: "Épée longue",
      quantity: 1,
      weapon: {
        category: "martial-melee",
        damageDice: "1d8",
        versatileDice: "1d10",
        damageType: "slashing",
        properties: ["versatile"],
      },
    };
    const item = normalizeItem(legacy);
    expect(item.weapon?.damageDice).toEqual({ count: 1, die: "d8" });
    expect(item.weapon?.versatileDice).toEqual({ count: 1, die: "d10" });
    // and again through the edit-draft path
    expect(toItemDraft(item).weapon?.damageDice).toEqual({ count: 1, die: "d8" });
  });
});

describe("cleanItems", () => {
  it("drops blank rows and trims", () => {
    const out = cleanItems([
      { id: "a", name: "  Corde  ", quantity: 1 },
      { id: "b", name: "   ", quantity: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Corde", consumable: false, quantity: 1 });
  });

  it("keeps quantity only for consumables", () => {
    const out = cleanItems([
      { id: "a", name: "Ration", consumable: true, quantity: 4 },
      { id: "b", name: "Dague", consumable: false, quantity: 9 },
    ]);
    expect(out[0].quantity).toBe(4);
    expect(out[1].quantity).toBe(1);
  });
});

const LONGSWORD: WeaponDef = {
  id: "longsword",
  name: "Épée longue",
  category: "martial-melee",
  priceCp: 1500,
  weightKg: 1.5,
  damageDice: { count: 1, die: "d8" },
  damageType: "slashing",
  properties: ["versatile"],
  mastery: "sap",
  versatileDice: { count: 1, die: "d10" },
};

const CHAIN_MAIL: ArmorDef = {
  id: "chain-mail",
  name: "Cotte de mailles",
  category: "heavy",
  priceCp: 7500,
  weightKg: 27.5,
  baseAc: 16,
  addsDex: false,
  strengthMin: 13,
  stealthDisadvantage: true,
};

describe("drafts from the 5e catalogue", () => {
  it("carries the weapon block, catalogId and price through clean + reload", () => {
    const draft = draftFromWeaponDef(LONGSWORD);
    expect(draft).toMatchObject({
      name: "Épée longue",
      catalogId: "longsword",
      priceCp: 1500,
      weapon: { damageDice: { count: 1, die: "d8" }, damageType: "slashing", mastery: "sap" },
    });

    const [item] = cleanItems([draft]);
    expect(item.weapon?.versatileDice).toEqual({ count: 1, die: "d10" });
    expect(item.catalogId).toBe("longsword");

    const reloaded = toItemDraft(item);
    expect(reloaded.weapon).toEqual(draft.weapon);
  });

  it("armour drafts start unequipped and keep the flag through a round-trip", () => {
    const draft = draftFromArmorDef(CHAIN_MAIL);
    expect(draft.armor).toMatchObject({ category: "heavy", baseAc: 16, equipped: false });

    const equipped = { ...draft, armor: { ...draft.armor!, equipped: true } };
    const [item] = cleanItems([equipped]);
    expect(item.armor?.equipped).toBe(true);
    expect(toItemDraft(item).armor?.equipped).toBe(true);
  });
});

describe("withArmorEquipped", () => {
  const piece = (id: string, category: "light" | "heavy" | "shield", equipped: boolean) => ({
    id,
    armor: { category, equipped },
  });

  it("takes off the body armour already worn, and keeps the shield", () => {
    const items = [
      piece("a", "light", true),
      piece("b", "heavy", false),
      piece("s", "shield", true),
    ];
    expect(withArmorEquipped(items, "b", true).map((item) => item.armor.equipped)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("swaps one shield for another", () => {
    const items = [piece("s1", "shield", true), piece("s2", "shield", false)];
    expect(withArmorEquipped(items, "s2", true).map((item) => item.armor.equipped)).toEqual([
      false,
      true,
    ]);
  });

  it("taking a piece off leaves the others alone", () => {
    const items = [piece("a", "light", true), piece("s", "shield", true)];
    expect(withArmorEquipped(items, "a", false).map((item) => item.armor.equipped)).toEqual([
      false,
      true,
    ]);
  });
});
