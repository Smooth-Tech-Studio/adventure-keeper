import type { AdventureEnemy, EnemyAttack } from "@adventure-keeper/schemas";
import { ABILITIES, type Ability } from "@/systems/dnd2024/vocabulary";

import {
  draftToLoot,
  emptyLootDraft,
  lootToDraft,
  type PlannedLootDraft,
} from "@/lib/planned-loot";
import type { WithId } from "@/lib/collections";

/** Ability scores as edited in the form — blank string = not set. */
export type AbilityScoreDraft = Partial<Record<Ability, string>>;

export interface EnemyFormValues {
  name: string;
  armorClass: string;
  maxHitPoints: string;
  speed: string;
  /** Location id / draft key, or "" for none. */
  locationId: string;
  notes: string;
  attacks: EnemyAttack[];
  sourceMonsterId?: string;
  challengeRating?: string;
  size?: AdventureEnemy["size"];
  abilityScores: AbilityScoreDraft;
  loot: PlannedLootDraft;
}

export const emptyEnemyForm = (): EnemyFormValues => ({
  name: "",
  armorClass: "13",
  maxHitPoints: "11",
  speed: "9",
  locationId: "",
  notes: "",
  attacks: [],
  abilityScores: {},
  loot: emptyLootDraft(),
});

export function enemyToForm(enemy: WithId<AdventureEnemy>): EnemyFormValues {
  return {
    name: enemy.name,
    armorClass: String(enemy.armorClass),
    maxHitPoints: String(enemy.maxHitPoints),
    speed: String(enemy.speed ?? 9),
    locationId: enemy.locationId ?? "",
    notes: enemy.notes ?? "",
    attacks: enemy.attacks ?? [],
    sourceMonsterId: enemy.sourceMonsterId,
    challengeRating: enemy.challengeRating,
    size: enemy.size,
    loot: lootToDraft(enemy.loot),
    abilityScores: Object.fromEntries(
      ABILITIES.map((a) => [
        a,
        enemy.abilityScores?.[a] != null ? String(enemy.abilityScores[a]) : "",
      ]),
    ),
  };
}

/** `EnemyFormValues` → the shared payload for `addEnemy` / `updateEnemy`. */
export function enemyFormToInput(v: EnemyFormValues) {
  const abilityScores = ABILITIES.reduce<Partial<Record<Ability, number>>>((acc, a) => {
    const n = Number(v.abilityScores[a]);
    if (v.abilityScores[a] && Number.isFinite(n) && n >= 1) acc[a] = Math.min(30, Math.trunc(n));
    return acc;
  }, {});

  return {
    name: v.name.trim(),
    armorClass: Number(v.armorClass) || 10,
    maxHitPoints: Number(v.maxHitPoints) || 1,
    speed: Number(v.speed) || 9,
    size: v.size,
    challengeRating: v.challengeRating,
    sourceMonsterId: v.sourceMonsterId,
    locationId: v.locationId || undefined,
    notes: v.notes.trim() || undefined,
    attacks: v.attacks.filter((atk) => atk.name.trim()),
    abilityScores: Object.keys(abilityScores).length ? abilityScores : undefined,
    loot: draftToLoot(v.loot),
  };
}
