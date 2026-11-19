import { z } from "zod";
import { monsterIdSchema } from "@adventure-keeper/system-dnd2024";
import { enemyAttackSchema } from "./enemy-attack";

/**
 * A creature that follows a character — today the familiar of « Appel de
 * familier » (or of the druid's « Compagnon sauvage »). Stored on the sheet,
 * so it stays from one session to the next until it is dismissed or drops to
 * 0 HP. Like an enemy, it **copies** its numbers from the monster bank when
 * summoned: the bank can change without touching it.
 *
 * In a fight it becomes a combatant of its own (`kind: "companion"`, `refId`
 * `"<characterId>:<id>"`), with its own initiative; its HP then live on the
 * combatant, and come back to the sheet when the fight ends.
 */
export const companionSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["familiar"]),
  name: z.string().trim().min(1).max(60),
  /** The bank beast it copies (`"owl"`, or a pack's `"pack:slug"`). */
  monsterId: monsterIdSchema.optional(),
  /** « Chouette » — the form, shown under the name. */
  formName: z.string().max(80).optional(),
  armorClass: z.number().int().min(0).max(40),
  maxHitPoints: z.number().int().min(1).max(999),
  currentHitPoints: z.number().int().min(0).max(999),
  /** Walking speed in feet. */
  speed: z.number().int().min(0).max(300).default(30),
  /** Dexterity modifier, for its initiative. */
  dexModifier: z.number().int().min(-5).max(10).default(0),
  attacks: z.array(enemyAttackSchema).max(10).default([]),
});
export type Companion = z.infer<typeof companionSchema>;
