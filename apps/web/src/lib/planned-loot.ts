import {
  ZERO_MONEY,
  type Item,
  type LootOfferSection,
  type Money,
  type PlannedLoot,
} from "@adventure-keeper/schemas";

import { normalizeMoney, toCopper } from "@/systems/dnd2024/lib/money";

/** Planned loot as a form or a file writes it: every part may be missing. */
export interface PlannedLootInput {
  items?: { name: string; quantity?: number }[];
  money?: Partial<Money>;
}

/** The loot to store: trimmed names, no empty line, and `undefined` when nothing is left. */
export function normalizePlannedLoot(input?: PlannedLootInput | null): PlannedLoot | undefined {
  if (!input) return undefined;
  const items = (input.items ?? [])
    .map((line) => ({
      name: line.name.trim(),
      quantity: Math.max(1, Math.trunc(line.quantity ?? 1) || 1),
    }))
    .filter((line) => line.name);
  const money = normalizeMoney({ ...ZERO_MONEY, ...input.money });
  if (items.length === 0 && toCopper(money) === 0) return undefined;
  return { items, money };
}

/**
 * What « Donner du butin » takes from planned loot: free inventory lines (a
 * stack of several is consumable, as for a line of the session's loot) and the
 * coins.
 */
export function plannedLootToGift(loot: PlannedLoot): {
  items: { section: LootOfferSection; item: Item }[];
  money: Money;
} {
  return {
    items: loot.items.map(({ name, quantity }) => ({
      section: "inventory" as const,
      item: { id: crypto.randomUUID(), name, quantity, consumable: quantity > 1 },
    })),
    money: normalizeMoney(loot.money),
  };
}

/** A planned loot offered in the session, with the name it was found on. */
export interface PlannedLootSource {
  key: string;
  kind: "enemy" | "location";
  /** The enemy's or location's name — it fills « Où ? ». */
  name: string;
  loot: PlannedLoot;
}

/**
 * The planned loot at hand: that of the enemies in the fight or waiting at the
 * current location, then that of the current location.
 */
export function plannedLootSources({
  enemies,
  locations,
  combatants,
  currentLocationId,
}: {
  enemies: { id: string; name: string; locationId?: string; loot?: PlannedLoot }[];
  locations: { id: string; name: string; loot?: PlannedLoot }[];
  combatants: { kind: string; refId: string }[];
  currentLocationId?: string;
}): PlannedLootSource[] {
  const fighting = new Set(combatants.filter((c) => c.kind === "enemy").map((c) => c.refId));
  const sources: PlannedLootSource[] = [];
  for (const enemy of enemies) {
    const here = Boolean(currentLocationId) && enemy.locationId === currentLocationId;
    const loot = normalizePlannedLoot(enemy.loot);
    if (loot && (fighting.has(enemy.id) || here)) {
      sources.push({ key: `enemy:${enemy.id}`, kind: "enemy", name: enemy.name, loot });
    }
  }
  const place = locations.find((l) => l.id === currentLocationId);
  const placeLoot = normalizePlannedLoot(place?.loot);
  if (place && placeLoot) {
    sources.push({
      key: `location:${place.id}`,
      kind: "location",
      name: place.name,
      loot: placeLoot,
    });
  }
  return sources;
}

/** Planned loot as edited in a form: quantities stay strings while typed. */
export interface PlannedLootDraft {
  items: { name: string; quantity: string }[];
  money: Money;
}

export const emptyLootDraft = (): PlannedLootDraft => ({ items: [], money: ZERO_MONEY });

export function lootToDraft(loot?: PlannedLoot): PlannedLootDraft {
  return {
    items: (loot?.items ?? []).map(({ name, quantity }) => ({ name, quantity: String(quantity) })),
    money: { ...ZERO_MONEY, ...loot?.money },
  };
}

/** The draft as `normalizePlannedLoot` takes it (empty lines are dropped there). */
export function draftToLoot(draft: PlannedLootDraft) {
  return {
    items: draft.items.map(({ name, quantity }) => ({
      name,
      quantity: Number.parseInt(quantity, 10) || 1,
    })),
    money: draft.money,
  };
}
