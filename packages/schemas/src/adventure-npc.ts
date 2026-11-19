import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { hexColorSchema } from "./character";

/**
 * `campaigns/{campaignId}/adventures/{adventureId}/npcs/{npcId}` — a
 * non-player character the GM authors for the adventure (ally, quest-giver,
 * villain…). GM-only content.
 */
export const adventureNpcSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  name: z.string().min(1).max(160),
  /** Temperament / demeanour in a few words, e.g. "Méfiant, avare". */
  personality: z.string().max(500).optional(),
  /** Background, role in the story, secrets. */
  lore: z.string().max(5000).optional(),
  /** Location this NPC is found at, if any. */
  locationId: z.string().min(1).optional(),
  /** Token colour on the session map (`#rrggbb`). */
  color: hexColorSchema.optional(),
  /**
   * The adventure enemy whose statistics the NPC fights with: set, it can
   * join a combat as an ally, under its own name.
   */
  enemyId: z.string().min(1).optional(),
  order: z.number().int().min(0).default(0),
});
export type AdventureNpc = z.infer<typeof adventureNpcSchema>;

export const adventureNpcCreateSchema = adventureNpcSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureNpcCreate = z.infer<typeof adventureNpcCreateSchema>;
