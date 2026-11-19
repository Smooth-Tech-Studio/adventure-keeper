import { z } from "zod";
import { auditFieldsSchema } from "./common";

/**
 * Who reads a piece of a character's story:
 *
 * - `private` — the player alone.
 * - `gm`      — the player and the GM of `campaignId`.
 * - `party`   — every member of `campaignId` (the GM included).
 *
 * `gm` and `party` need a `campaignId`: the rules check the reader against that
 * campaign's current owner / members, so a newcomer reads the past entries too.
 */
export const STORY_VISIBILITIES = ["private", "gm", "party"] as const;
export const storyVisibilitySchema = z.enum(STORY_VISIBILITIES);
export type StoryVisibility = z.infer<typeof storyVisibilitySchema>;

/** Fields shared by chapters and journal entries (both live under the character). */
const storyFields = {
  ownerId: z.string().min(1),
  characterId: z.string().min(1),
  visibility: storyVisibilitySchema.default("private"),
  campaignId: z.string().min(1).optional(),
  body: z.string().max(20000).default(""),
};

/**
 * `characters/{characterId}/chapters/{chapterId}` — a chapter of the
 * character's past (« Enfance à Port-Brume », « La trahison »…), in order.
 * The sheet's `lore` stays its prologue.
 */
export const characterChapterSchema = auditFieldsSchema.extend({
  ...storyFields,
  title: z.string().min(1).max(160),
  order: z.number().int().min(0).default(0),
  /** An illustration shown at the head of the chapter (an external link). */
  imageUrl: z.string().url().max(2000).optional(),
});
export type CharacterChapter = z.infer<typeof characterChapterSchema>;

/**
 * `characters/{characterId}/journal/{entryId}` — the character's own account
 * of what they lived, usually of one session. The same entry fills the
 * character's journal and, when shared with the party, the adventure's
 * chronicle. Context is snapshot for display: the journal outlives campaigns.
 */
export const journalEntrySchema = auditFieldsSchema.extend({
  ...storyFields,
  /** Snapshot, shown in the chronicle. */
  characterName: z.string().min(1).max(120),
  title: z.string().max(160).optional(),
  campaignName: z.string().max(160).optional(),
  adventureId: z.string().min(1).optional(),
  adventureTitle: z.string().max(160).optional(),
  sessionId: z.string().min(1).optional(),
  sessionNumber: z.number().int().min(1).optional(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;
