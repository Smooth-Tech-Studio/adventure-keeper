import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  ARMOR_CATEGORIES,
  BACKGROUNDS,
  CLASSES,
  DAMAGE_TYPES,
  TOOL_CATEGORIES,
  TOOL_CHOICE_GROUPS,
  WEAPON_CATEGORIES,
  WEAPON_MASTERIES,
  WEAPON_PROPERTIES,
  BACKGROUND_STARTING_EQUIPMENT,
  backgroundFixedToolId,
  type ArmorDef,
  type EquipmentRefKind,
  type EquipmentPackDef,
  type GearDef,
  type ToolDef,
  type WeaponDef,
} from "../index";

import armorsFile from "./armors.json";
import gearFile from "./gear.json";
import packsFile from "./equipment-packs.json";
import toolsFile from "./tools.json";
import weaponsFile from "./weapons.json";

const armors = armorsFile.entries;
const gear = gearFile.entries;
const packs = packsFile.entries;
const tools = toolsFile.entries;
const weapons = weaponsFile.entries;

const WEAPONS = weapons as WeaponDef[];
const ARMORS = armors as ArmorDef[];
const TOOLS = tools as ToolDef[];
const GEAR = gear as GearDef[];
const PACKS = packs as EquipmentPackDef[];

function expectUniqueIds(rows: { id: string }[]) {
  const ids = rows.map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("weapons.json", () => {
  it("has unique ids", () => expectUniqueIds(WEAPONS));

  it("every row uses known enums and non-negative numbers", () => {
    for (const w of WEAPONS) {
      expect(WEAPON_CATEGORIES).toContain(w.category);
      expect(w.priceCp).toBeGreaterThanOrEqual(0);
      if (w.weightKg !== undefined) expect(w.weightKg).toBeGreaterThanOrEqual(0);
      for (const property of w.properties) expect(WEAPON_PROPERTIES).toContain(property);
      if (w.mastery) expect(WEAPON_MASTERIES).toContain(w.mastery);

      if (w.category === "focus") {
        // A focus is listed among weapons but carries no attack data.
        expect(w.damageDice).toBeUndefined();
        expect(w.damageType).toBeUndefined();
        expect(w.mastery).toBeUndefined();
        expect(w.properties).toHaveLength(0);
      } else {
        expect(DAMAGE_TYPES).toContain(w.damageType);
        expect(WEAPON_MASTERIES).toContain(w.mastery);
        if (w.properties.includes("thrown") || w.properties.includes("ammunition")) {
          expect(w.range?.normal).toBeGreaterThan(0);
          expect(w.range?.max).toBeGreaterThanOrEqual(w.range!.normal);
        }
        if (w.properties.includes("versatile")) expect(w.versatileDice).toBeTruthy();
      }
    }
  });
});

describe("armors.json", () => {
  it("has unique ids", () => expectUniqueIds(ARMORS));

  it("body armour adds Dex per category; shields carry a flat bonus", () => {
    for (const a of ARMORS) {
      expect(ARMOR_CATEGORIES).toContain(a.category);
      expect(a.priceCp).toBeGreaterThanOrEqual(0);
      if (a.category === "shield") {
        expect(a.acBonus).toBeGreaterThan(0);
      } else {
        expect(a.baseAc).toBeGreaterThan(0);
        expect(a.addsDex).toBe(a.category !== "heavy");
        if (a.category === "medium") expect(a.maxDex).toBe(2);
      }
    }
  });

  it("dit ce qu'est chaque pièce — « Broigne » ne parle à personne", () => {
    for (const a of ARMORS) {
      expect(a.description, a.name).toBeTruthy();
      expect(a.description!.endsWith("."), a.name).toBe(true);
    }
  });
});

describe("tools.json", () => {
  it("has unique ids and known category / ability", () => {
    expectUniqueIds(TOOLS);
    for (const t of TOOLS) {
      expect(TOOL_CATEGORIES).toContain(t.category);
      expect(ABILITIES).toContain(t.ability);
      expect(t.priceCp).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers every fixed tool proficiency granted by a class or background", () => {
    const ids = new Set(TOOLS.map((t) => t.id));
    for (const klass of CLASSES) {
      for (const toolId of klass.toolProficiencies) expect(ids).toContain(toolId);
    }
    for (const background of BACKGROUNDS) {
      const fixed = backgroundFixedToolId(background);
      if (fixed) expect(ids).toContain(fixed);
    }
  });
});

describe("gear.json + equipment-packs.json", () => {
  it("gear has unique ids and non-negative prices", () => {
    expectUniqueIds(GEAR);
    for (const g of GEAR) expect(g.priceCp).toBeGreaterThanOrEqual(0);
  });

  it("every pack entry references an existing gear id", () => {
    expectUniqueIds(PACKS);
    const ids = new Set(GEAR.map((g) => g.id));
    for (const pack of PACKS) {
      for (const entry of pack.contents) {
        expect(ids).toContain(entry.gearId);
        expect(entry.qty).toBeGreaterThan(0);
      }
    }
  });
});

describe("starting-equipment.ts references the catalogues", () => {
  const BY_KIND: Record<EquipmentRefKind, Set<string>> = {
    weapon: new Set(WEAPONS.map((row) => row.id)),
    armor: new Set(ARMORS.map((row) => row.id)),
    tool: new Set(TOOLS.map((row) => row.id)),
    gear: new Set(GEAR.map((row) => row.id)),
    pack: new Set(PACKS.map((row) => row.id)),
  };

  const CLASS_KITS = Object.fromEntries(
    CLASSES.map((klass) => [klass.id, klass.startingEquipment!]),
  );
  const ALL_DEFS = [...Object.values(CLASS_KITS), ...Object.values(BACKGROUND_STARTING_EQUIPMENT)];

  it("covers the 12 classes and the 4 SRD backgrounds, plus the custom one", () => {
    expect(Object.keys(CLASS_KITS)).toHaveLength(12);
    expect(Object.keys(BACKGROUND_STARTING_EQUIPMENT)).toHaveLength(5);
    expect(BACKGROUND_STARTING_EQUIPMENT.custom).toBeDefined();
  });

  it("points every item at an id that exists in its catalogue", () => {
    const missing: string[] = [];
    for (const def of ALL_DEFS) {
      for (const option of def.options) {
        for (const item of option.items) {
          // An item the player's own tool choice supplies has no fixed id.
          if (item.fromChoice) continue;
          if (!item.id || !BY_KIND[item.kind].has(item.id)) {
            missing.push(`${def.id}/${option.id}: ${item.kind} "${item.id}"`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every owner exactly one gold-only option", () => {
    for (const def of ALL_DEFS) {
      const goldOnly = def.options.filter((option) => option.items.length === 0);
      expect(goldOnly, def.id).toHaveLength(1);
      expect(goldOnly[0].gold, def.id).toBeGreaterThan(0);
    }
  });

  it("gives the Fighter three options and every rulebook background two", () => {
    expect(CLASS_KITS.fighter.options).toHaveLength(3);
    for (const [id, def] of Object.entries(BACKGROUND_STARTING_EQUIPMENT)) {
      // The custom background has no package of its own — only the gold.
      expect(def.options, id).toHaveLength(id === "custom" ? 1 : 2);
    }
  });

  it("gives every background a 50 po gold-only option", () => {
    for (const def of Object.values(BACKGROUND_STARTING_EQUIPMENT)) {
      const goldOnly = def.options.find((option) => option.items.length === 0);
      expect(goldOnly?.gold, def.id).toBe(50);
    }
  });

  it("keeps option ids unique and quantities positive", () => {
    for (const def of ALL_DEFS) {
      const ids = def.options.map((option) => option.id);
      expect(new Set(ids).size, def.id).toBe(ids.length);
      for (const option of def.options) {
        for (const item of option.items) {
          expect(item.qty ?? 1, `${def.id}/${item.id ?? item.fromChoice}`).toBeGreaterThan(0);
          // Exactly one of the two supplies the item.
          expect(Boolean(item.id) !== Boolean(item.fromChoice), `${def.id}/${item.kind}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("restricts every tool-group pick to a real ToolChoiceGroup", () => {
    const groups = new Set<string>(TOOL_CHOICE_GROUPS);
    for (const def of ALL_DEFS) {
      for (const option of def.options) {
        for (const choice of option.choices ?? []) {
          if (choice.pool.kind !== "group") continue;
          expect(groups, `${choice.id} → ${choice.pool.group}`).toContain(choice.pool.group);
        }
      }
    }
  });

  it("namespaces every inner choice on its owner", () => {
    for (const def of ALL_DEFS) {
      for (const option of def.options) {
        for (const choice of option.choices ?? []) {
          expect(choice.id.startsWith(`${def.id}:`), choice.id).toBe(true);
        }
      }
    }
  });
});
