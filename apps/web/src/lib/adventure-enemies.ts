import { deleteField } from "firebase/firestore";
import { COLLECTIONS, adventureEnemySchema, type AdventureEnemy } from "@adventure-keeper/schemas";

import { adventureSubCollection } from "@/lib/adventure-crud";
import { normalizePlannedLoot, type PlannedLootInput } from "@/lib/planned-loot";

const enemies = adventureSubCollection<AdventureEnemy>(COLLECTIONS.enemies, {
  schema: adventureEnemySchema,
});

export interface CreateEnemyInput {
  name: string;
  armorClass: number;
  maxHitPoints: number;
  speed?: number;
  color?: string;
  size?: AdventureEnemy["size"];
  challengeRating?: string;
  sourceMonsterId?: string;
  locationId?: string;
  notes?: string;
  attacks?: AdventureEnemy["attacks"];
  abilityScores?: AdventureEnemy["abilityScores"];
  /** Not edited in the app, but kept when a campaign file brings them. */
  description?: string;
  imageUrl?: string;
  loot?: PlannedLootInput;
}

export interface UpdateEnemyInput {
  name: string;
  armorClass: number;
  maxHitPoints: number;
  speed: number;
  size?: AdventureEnemy["size"];
  challengeRating?: string;
  sourceMonsterId?: string;
  locationId?: string;
  notes?: string;
  attacks: AdventureEnemy["attacks"];
  abilityScores?: AdventureEnemy["abilityScores"];
  loot?: PlannedLootInput;
}

export const listEnemies = enemies.list;
export const deleteEnemy = enemies.remove;

export function addEnemy(
  campaignId: string,
  adventureId: string,
  input: CreateEnemyInput,
): Promise<string> {
  return enemies.add(campaignId, adventureId, {
    name: input.name,
    armorClass: input.armorClass,
    maxHitPoints: input.maxHitPoints,
    speed: input.speed ?? 30,
    color: input.color,
    size: input.size,
    challengeRating: input.challengeRating,
    sourceMonsterId: input.sourceMonsterId,
    locationId: input.locationId,
    notes: input.notes?.trim() || undefined,
    attacks: input.attacks ?? [],
    abilityScores: input.abilityScores,
    description: input.description?.trim() || undefined,
    imageUrl: input.imageUrl,
    loot: normalizePlannedLoot(input.loot),
  });
}

export function updateEnemy(
  campaignId: string,
  adventureId: string,
  enemyId: string,
  values: UpdateEnemyInput,
): Promise<void> {
  return enemies.patch(campaignId, adventureId, enemyId, {
    name: values.name.trim(),
    armorClass: values.armorClass,
    maxHitPoints: values.maxHitPoints,
    speed: values.speed,
    size: values.size ?? deleteField(),
    challengeRating: values.challengeRating ?? deleteField(),
    sourceMonsterId: values.sourceMonsterId ?? deleteField(),
    locationId: values.locationId ?? deleteField(),
    notes: values.notes?.trim() || deleteField(),
    attacks: values.attacks,
    abilityScores:
      values.abilityScores && Object.keys(values.abilityScores).length
        ? values.abilityScores
        : deleteField(),
    loot: normalizePlannedLoot(values.loot) ?? deleteField(),
  });
}
