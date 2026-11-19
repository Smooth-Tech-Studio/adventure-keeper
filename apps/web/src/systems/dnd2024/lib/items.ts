import type { Item } from "@adventure-keeper/schemas";
import {
  armorPropsFromDef,
  coerceDicePool,
  toolPropsFromDef,
  weaponPropsFromDef,
  type ArmorDef,
  type ArmorProps,
  type GearDef,
  type ToolDef,
  type ToolProps,
  type WeaponDef,
  type WeaponProps,
} from "@adventure-keeper/system-dnd2024";
import { tr } from "@/i18n";

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Armour props as stored on a draft / item (adds the worn flag). */
export type ArmorItemProps = ArmorProps & { equipped: boolean };

/** An item being edited in a form (before it is cleaned into an `Item`). */
export interface ItemDraft {
  id: string;
  name: string;
  lore?: string;
  consumable?: boolean;
  quantity: number;
  /** Back-reference to the 5e catalogue entry this came from. */
  catalogId?: string;
  priceCp?: number;
  weightKg?: number;
  weapon?: WeaponProps;
  armor?: ArmorItemProps;
  tool?: ToolProps;
}

export function makeItemDraft(): ItemDraft {
  return { id: uid(), name: "", consumable: false, quantity: 1 };
}

type WornArmor = { category: ArmorProps["category"]; equipped?: boolean };

/**
 * Wear or take off one armour piece. A character wears one body armour and
 * one shield: putting one on takes off the piece already in that slot.
 */
export function withArmorEquipped<T extends { id: string; armor?: WornArmor }>(
  items: T[],
  id: string,
  equipped: boolean,
): T[] {
  const target = items.find((item) => item.id === id)?.armor;
  if (!target) return items;
  const isShield = target.category === "shield";
  return items.map((item) => {
    if (!item.armor) return item;
    if (item.id === id) return { ...item, armor: { ...item.armor, equipped } };
    if (equipped && item.armor.equipped && (item.armor.category === "shield") === isShield) {
      return { ...item, armor: { ...item.armor, equipped: false } };
    }
    return item;
  });
}

/** Which structured fieldset an item-list editor shows. `plain` = free item. */
export type EquipmentKind = "weapon" | "armor" | "tool" | "gear" | "plain";

/** Starting block for a hand-made weapon. */
export function defaultWeaponProps(): WeaponProps {
  return {
    category: "simple-melee",
    damageDice: { count: 1, die: "d4" },
    damageType: "bludgeoning",
    properties: [],
  };
}

/** Starting block for a hand-made armour. */
export function defaultArmorProps(): ArmorItemProps {
  return {
    category: "light",
    baseAc: 11,
    addsDex: true,
    stealthDisadvantage: false,
    equipped: false,
  };
}

/** Starting block for a hand-made tool. */
export function defaultToolProps(): ToolProps {
  return { category: "artisan", ability: "int" };
}

/**
 * Repair a stored weapon block. Weapons saved before `DicePool` was introduced
 * keep `damageDice` / `versatileDice` as strings (`"1d8"`); left as-is they
 * render as `"undefined"`. Coerce them back to a pool on every read.
 */
export function coerceWeaponProps(weapon: WeaponProps): WeaponProps {
  const damageDice = coerceDicePool(weapon.damageDice) ?? undefined;
  const versatileDice = coerceDicePool(weapon.versatileDice) ?? undefined;
  if (damageDice === weapon.damageDice && versatileDice === weapon.versatileDice) return weapon;
  return { ...weapon, damageDice, versatileDice };
}

/** Stored item → editable draft. */
export function toItemDraft(item: Item): ItemDraft {
  return {
    id: item.id,
    name: item.name,
    lore: item.lore,
    consumable: item.consumable ?? item.quantity > 1,
    quantity: item.quantity,
    catalogId: item.catalogId,
    priceCp: item.priceCp,
    weightKg: item.weightKg,
    weapon: item.weapon ? coerceWeaponProps(item.weapon) : undefined,
    armor: item.armor ? { ...item.armor, equipped: item.armor.equipped ?? false } : undefined,
    tool: item.tool,
  };
}

function withCatalogFields(draft: ItemDraft, base: Item): Item {
  const item: Item = { ...base };
  if (draft.catalogId) item.catalogId = draft.catalogId;
  if (typeof draft.priceCp === "number") item.priceCp = draft.priceCp;
  if (typeof draft.weightKg === "number") item.weightKg = draft.weightKg;
  if (draft.weapon) item.weapon = draft.weapon;
  if (draft.armor) item.armor = { ...draft.armor, equipped: Boolean(draft.armor.equipped) };
  if (draft.tool) item.tool = draft.tool;
  return item;
}

function cleanDraft(item: ItemDraft): Item {
  return withCatalogFields(item, {
    id: item.id,
    name: item.name.trim(),
    lore: item.lore?.trim() ? item.lore.trim() : undefined,
    consumable: Boolean(item.consumable),
    quantity: item.consumable ? Math.max(1, Math.round(item.quantity) || 1) : 1,
  });
}

/** Drafts → clean `Item[]` (drop blanks; quantity 1 unless consumable). */
export function cleanItems(items: ItemDraft[]): Item[] {
  return items.filter((item) => item.name.trim().length > 0).map(cleanDraft);
}

/**
 * "Dague · Arc court · Potion ×5" — a compact one-line recap of an item list,
 * used as a `CollapsibleCard` `summary` when the section is collapsed.
 */
export function itemListSummary(
  items: { name: string; quantity: number }[],
  empty = tr("common:noItems"),
): string {
  const named = items.filter((item) => item.name.trim().length > 0);
  if (named.length === 0) return empty;
  return named
    .map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name))
    .join(" · ");
}

/** Turn a stored value (legacy `string`, or a full `Item`) into a clean `Item`. */
export function normalizeItem(raw: unknown): Item {
  if (typeof raw === "string") return parseEquipmentLine(raw);
  const item = raw as Partial<Item>;
  const quantity = Math.max(1, Math.round(item.quantity ?? 1) || 1);
  const consumable = item.consumable ?? quantity > 1;
  const base: Item = {
    id: item.id || uid(),
    name: item.name ?? "",
    lore: item.lore,
    consumable,
    quantity: consumable ? quantity : 1,
  };
  if (item.catalogId) base.catalogId = item.catalogId;
  if (typeof item.priceCp === "number") base.priceCp = item.priceCp;
  if (typeof item.weightKg === "number") base.weightKg = item.weightKg;
  if (item.weapon) base.weapon = coerceWeaponProps(item.weapon);
  if (item.armor) base.armor = { ...item.armor, equipped: item.armor.equipped ?? false };
  if (item.tool) base.tool = item.tool;
  return base;
}

export function normalizeItems(raw: unknown): Item[] {
  return Array.isArray(raw) ? raw.map(normalizeItem) : [];
}

/** `"Torche ×5"` → a consumable of qty 5; a bare name → a unique object. */
export function parseEquipmentLine(line: string): Item {
  const match = line.trim().match(/^(.*?)\s*[×x]\s*(\d+)$/);
  if (match) {
    return {
      id: uid(),
      name: match[1].trim(),
      consumable: true,
      quantity: Math.max(1, Number(match[2]) || 1),
    };
  }
  return { id: uid(), name: line.trim(), consumable: false, quantity: 1 };
}

/** Copy sheet items (weapons / armour / inventory) into adventure-scoped items. */
export function copyItem(item: {
  id: string;
  name: string;
  lore?: string;
  consumable?: boolean;
  quantity: number;
}): Item {
  const consumable = item.consumable ?? item.quantity > 1;
  return {
    id: uid(),
    name: item.name,
    lore: item.lore,
    consumable,
    quantity: consumable ? Math.max(1, item.quantity) : 1,
  };
}

// --- Drafts from the 5e catalogue ---------------------------------------

export function draftFromWeaponDef(def: WeaponDef): ItemDraft {
  return {
    id: uid(),
    name: def.name,
    consumable: false,
    quantity: 1,
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
    weapon: weaponPropsFromDef(def),
  };
}

export function draftFromArmorDef(def: ArmorDef): ItemDraft {
  return {
    id: uid(),
    name: def.name,
    consumable: false,
    quantity: 1,
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
    armor: { ...armorPropsFromDef(def), equipped: false },
  };
}

export function draftFromToolDef(def: ToolDef): ItemDraft {
  return {
    id: uid(),
    name: def.name,
    consumable: false,
    quantity: 1,
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
    tool: toolPropsFromDef(def),
  };
}

export function draftFromGearDef(def: GearDef): ItemDraft {
  return {
    id: uid(),
    name: def.name,
    consumable: def.group === "ammunition",
    quantity: 1,
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
  };
}
