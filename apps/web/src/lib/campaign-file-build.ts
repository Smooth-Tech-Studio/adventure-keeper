import type {
  AdventureEnemy,
  AdventureEvent,
  AdventureLocation,
  AdventureNpc,
  FileAdventure,
  PlannedLoot,
} from "@adventure-keeper/schemas";

import { COINS } from "@/systems/dnd2024/lib/money";

/** What one adventure holds, as read from Firestore. */
export interface AdventureContent {
  title: string;
  summary?: string;
  locations: (AdventureLocation & { id: string })[];
  enemies: AdventureEnemy[];
  npcs: AdventureNpc[];
  events: AdventureEvent[];
}

/** Planned loot as a file writes it: names, quantities above 1, only the coins held. */
function fileLootOf(loot?: PlannedLoot) {
  if (!loot) return undefined;
  const items = loot.items.map(({ name, quantity }) =>
    quantity > 1 ? { name, quantity } : { name },
  );
  const money = Object.fromEntries(
    COINS.filter(({ key }) => loot.money[key] > 0).map(({ key }) => [key, loot.money[key]]),
  );
  return compact({ items, money }) as FileAdventure["enemies"][number]["loot"];
}

/** Drop the fields left empty, so the file reads like one written by hand. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) =>
        entry !== undefined &&
        entry !== "" &&
        !(Array.isArray(entry) && entry.length === 0) &&
        !(
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          !Object.keys(entry).length
        ),
    ),
  ) as T;
}

/**
 * An adventure as it goes into a file: locations in order, referenced by
 * name, and none of what play added (revealed highlights stay unrevealed).
 */
export function fileAdventureOf(content: AdventureContent): FileAdventure {
  const byOrder = <T extends { order?: number }>(list: T[]) =>
    [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const locationName = new Map(content.locations.map((l) => [l.id, l.name]));
  const where = (id?: string) => (id ? locationName.get(id) : undefined);
  return compact({
    title: content.title,
    summary: content.summary,
    locations: byOrder(content.locations).map((l) =>
      compact({
        name: l.name,
        description: l.description,
        imageUrl: l.imageUrl,
        hidden: l.hidden || undefined,
        loot: fileLootOf(l.loot),
      }),
    ),
    enemies: content.enemies.map((e) =>
      compact({
        name: e.name,
        description: e.description,
        sourceMonsterId: e.sourceMonsterId,
        location: where(e.locationId),
        color: e.color,
        size: e.size,
        armorClass: e.armorClass,
        maxHitPoints: e.maxHitPoints,
        speed: e.speed,
        abilityScores: e.abilityScores,
        challengeRating: e.challengeRating,
        attacks: e.attacks,
        imageUrl: e.imageUrl,
        notes: e.notes,
        loot: fileLootOf(e.loot),
      }),
    ),
    npcs: byOrder(content.npcs).map((n) =>
      compact({
        name: n.name,
        personality: n.personality,
        lore: n.lore,
        location: where(n.locationId),
        color: n.color,
      }),
    ),
    events: byOrder(content.events).map((e) =>
      compact({
        title: e.title,
        description: e.description,
        trigger: e.trigger,
        dueDay: e.dueDay,
        dueTime: e.dueTime,
      }),
    ),
  }) as FileAdventure;
}
