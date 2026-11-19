import { z } from "zod";
import { auditFieldsSchema } from "./common";

/**
 * `campaigns/{campaignId}/adventures/{adventureId}/events/{eventId}` —
 * a key story beat the GM plans for the adventure.
 */
export const adventureEventSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(5000).optional(),
  /** What sets the event off (condition, location reached, choice made...). */
  trigger: z.string().max(500).optional(),
  /**
   * When it comes due on the game clock — a day (`gameDay`), a time
   * (`HH:MM`), or both. The GM's panel then says « c'est l'heure »; the GM
   * still reveals it.
   */
  dueDay: z.number().int().min(1).max(100000).optional(),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  order: z.number().int().min(0).default(0),
  /** Whether the event has happened / been revealed to players. */
  isRevealed: z.boolean().default(false),
  /** Live session during which the GM revealed it. */
  revealedSessionId: z.string().min(1).optional(),
});
export type AdventureEvent = z.infer<typeof adventureEventSchema>;

export const adventureEventCreateSchema = adventureEventSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureEventCreate = z.infer<typeof adventureEventCreateSchema>;
