import {
  ARMOR_CATEGORIES,
  ARMOR_CATEGORY_LABELS,
  TOOL_CATEGORIES,
  TOOL_CATEGORY_DESCRIPTIONS,
  TOOL_CATEGORY_LABELS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  WEAPON_MASTERY_LABELS,
  WEAPON_PROPERTY_LABELS,
  armorClassFormula,
  formatCoinPrice,
  formatDicePool,
  type ArmorDef,
  type GearDef,
  type ToolDef,
  type WeaponDef,
} from "@adventure-keeper/system-dnd2024";

import type { CatalogOption } from "@/components/character/item-list-editor";
import { tr } from "@/i18n";

const GEAR_GROUPS = new Set(["ammunition", "container", "light", "potion"]);
const gearGroupLabel = (group: string | undefined) =>
  tr(`common:gear.${group && GEAR_GROUPS.has(group) ? group : "other"}` as "common:gear.other");

/** Catalogue defs → grouped picker rows for `ItemListEditor`. */
export function weaponOptions(defs: WeaponDef[] | null): CatalogOption[] {
  return [...(defs ?? [])]
    .sort((a, b) => WEAPON_CATEGORIES.indexOf(a.category) - WEAPON_CATEGORIES.indexOf(b.category))
    .map((def) => ({
      id: def.id,
      name: def.name,
      hint: def.damageDice
        ? `${formatDicePool(def.damageDice)} · ${formatCoinPrice(def.priceCp)}`
        : formatCoinPrice(def.priceCp),
      // Damage alone does not decide a weapon: finesse, light and the mastery
      // are what the choice actually turns on.
      description: [
        ...def.properties.map((property) => WEAPON_PROPERTY_LABELS[property]),
        def.mastery ? `botte : ${WEAPON_MASTERY_LABELS[def.mastery]}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      group: WEAPON_CATEGORY_LABELS[def.category],
    }));
}

export function armorOptions(defs: ArmorDef[] | null): CatalogOption[] {
  return [...(defs ?? [])]
    .sort((a, b) => ARMOR_CATEGORIES.indexOf(a.category) - ARMOR_CATEGORIES.indexOf(b.category))
    .map((def) => ({
      id: def.id,
      name: def.name,
      hint: `CA ${armorClassFormula(def)}`,
      description: def.description,
      group: ARMOR_CATEGORY_LABELS[def.category],
    }));
}

export function toolOptions(defs: ToolDef[] | null): CatalogOption[] {
  return [...(defs ?? [])]
    .sort((a, b) => TOOL_CATEGORIES.indexOf(a.category) - TOOL_CATEGORIES.indexOf(b.category))
    .map((def) => ({
      id: def.id,
      name: def.name,
      hint: formatCoinPrice(def.priceCp),
      description: def.description ?? TOOL_CATEGORY_DESCRIPTIONS[def.category],
      group: TOOL_CATEGORY_LABELS[def.category],
    }));
}

export function gearOptions(defs: GearDef[] | null): CatalogOption[] {
  return (defs ?? []).map((def) => ({
    id: def.id,
    name: def.name,
    hint: formatCoinPrice(def.priceCp),
    description: def.description,
    group: gearGroupLabel(def.group),
  }));
}
