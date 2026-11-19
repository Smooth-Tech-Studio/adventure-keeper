import { z } from "zod";
import { conditionSchema, creatureSizeSchema } from "@adventure-keeper/system-dnd2024";
import { auditFieldsSchema } from "./common";
import { hexColorSchema } from "./character";

/** A character, an enemy, or a character's companion (its familiar). */
export const combatantKindSchema = z.enum(["participant", "enemy", "companion"]);
export type CombatantKind = z.infer<typeof combatantKindSchema>;

/**
 * `campaigns/{c}/adventures/{a}/liveSessions/{s}/combatants/{combatantId}` —
 * one entry in a live session's fight: a participating character or an enemy
 * instance. Holds its live HP and, when placed, its token position on the map
 * (`x` / `y` as fractions 0–1 of the current location image).
 */
export const sessionCombatantSchema = auditFieldsSchema.extend({
  sessionId: z.string().min(1),
  kind: combatantKindSchema,
  /**
   * `characterId` for a participant, `enemyId` (template) for an enemy,
   * `"<characterId>:<companionId>"` for a companion.
   */
  refId: z.string().min(1),
  name: z.string().min(1).max(120),
  color: hexColorSchema.optional(),
  maxHitPoints: z.number().int().min(1),
  currentHitPoints: z.number().int(),
  armorClass: z.number().int().min(0).max(40),
  onMap: z.boolean().default(false),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  /** Initiative score, set when a combat is started. */
  initiative: z.number().int().optional(),
  /** uid of the controlling player, for participants and their companions. */
  playerId: z.string().min(1).optional(),
  /** Creature size: the token covers as many squares (absent = Medium). */
  size: creatureSizeSchema.optional(),
  /** Conditions the GM tracks on this combatant (adventure opt-in). */
  conditions: z.array(conditionSchema).max(20).optional(),
  /**
   * An enemy profile fighting on the party's side (an allied NPC): the GM
   * plays it like an enemy, but it is not one — teal token, not « defeated ».
   */
  ally: z.boolean().optional(),
});
export type SessionCombatant = z.infer<typeof sessionCombatantSchema>;

export const sessionCombatantCreateSchema = sessionCombatantSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type SessionCombatantCreate = z.infer<typeof sessionCombatantCreateSchema>;
