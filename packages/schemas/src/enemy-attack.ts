import { z } from "zod";
import { damageKindSchema, dicePoolSchema } from "@adventure-keeper/system-dnd2024";

/**
 * One enemy attack — the "simple" model: a to-hit bonus and structured damage
 * dice. Saving throws, riders and multiattack go in `notes` (free text).
 */
export const enemyAttackSchema = z.object({
  name: z.string().min(1).max(120),
  /** Attack-roll bonus, e.g. +5. Absent for an automatic / save-only effect. */
  toHit: z.number().int().optional(),
  /** Reach / range as written, e.g. "1,50 m" or "24/96 m". */
  reach: z.string().max(40).optional(),
  /** Damage dice. */
  damage: dicePoolSchema.optional(),
  /** Flat bonus added to the damage roll. */
  damageBonus: z.number().int().optional(),
  damageKind: damageKindSchema.optional(),
  /** Saving throws, extra damage, multiattack… — anything the simple model omits. */
  notes: z.string().max(500).optional(),
});
export type EnemyAttack = z.infer<typeof enemyAttackSchema>;
