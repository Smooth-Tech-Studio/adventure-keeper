import { z } from "zod";
import { abilityScoreBlockSchema, creatureSizeSchema } from "@adventure-keeper/system-dnd2024";
import { auditFieldsSchema } from "./common";
import { hexColorSchema } from "./character";
import { enemyAttackSchema } from "./enemy-attack";
import { plannedLootSchema } from "./planned-loot";

// The attack line lives in its own module: a character's familiar uses it too,
// and `character.ts` cannot import this file (it imports `character.ts`).
export { enemyAttackSchema, type EnemyAttack } from "./enemy-attack";

/**
 * `campaigns/{campaignId}/adventures/{adventureId}/enemies/{enemyId}` —
 * a stat block for a foe (or group of identical foes) in the adventure.
 */
export const adventureEnemySchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  /** Id of the `MONSTERS` entry this block was created from, if any. */
  sourceMonsterId: z.string().min(1).optional(),
  /** Location this foe is encountered at, if any. */
  locationId: z.string().min(1).optional(),
  /** Token colour on the session map (`#rrggbb`). */
  color: hexColorSchema.optional(),
  size: creatureSizeSchema.optional(),
  /**
   * @deprecated An adventure enemy is a *type*, not a quantity — the GM adds as
   * many instances as needed when setting up a combat. Kept optional so legacy
   * documents still parse; never written or shown any more.
   */
  count: z.number().int().min(1).optional(),
  armorClass: z.number().int().min(0).max(40),
  maxHitPoints: z.number().int().min(1),
  /** In metres, as shown — half metres included (25 ft = 7,5 m). */
  speed: z.number().min(0).default(30),
  abilityScores: abilityScoreBlockSchema.partial().optional(),
  /** Challenge rating as written, e.g. "1/4", "5". */
  challengeRating: z.string().max(10).optional(),
  attacks: z.array(enemyAttackSchema).max(20).default([]),
  imageUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
  /** What it carries, ready to give once it falls (see `plannedLootSchema`). */
  loot: plannedLootSchema.optional(),
});
export type AdventureEnemy = z.infer<typeof adventureEnemySchema>;

export const adventureEnemyCreateSchema = adventureEnemySchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureEnemyCreate = z.infer<typeof adventureEnemyCreateSchema>;
