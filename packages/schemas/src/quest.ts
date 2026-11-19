import { z } from "zod";
import { auditFieldsSchema } from "./common";

/** A rumour heard, a quest taken on, then accomplished — or failed. */
export const QUEST_STATUSES = ["rumor", "active", "done", "failed"] as const;
export const questStatusSchema = z.enum(QUEST_STATUSES);
export type QuestStatus = z.infer<typeof questStatusSchema>;

/** A quest revealed, or moved to a status, during a session. */
export const questMilestoneSchema = z.object({
  kind: z.union([z.literal("revealed"), questStatusSchema]),
  adventureId: z.string().min(1),
  sessionId: z.string().min(1),
  /** « Séance 3 » — the session's rank in its adventure. */
  sessionNumber: z.number().int().min(1).optional(),
});
export type QuestMilestone = z.infer<typeof questMilestoneSchema>;

/**
 * `campaigns/{campaignId}/quests/{questId}` — the campaign's quest board.
 * Players read the revealed quests (`where("revealed", "==", true)`); the GM
 * keeps the rest for later. `[[Nom]]` in the summary links to the codex.
 *
 * A player may write their own quests too (`ownerUid`): personal, seen by them
 * and the GM, or shared with the party — `revealed` then means « shared ».
 */
export const questSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  title: z.string().min(1).max(160),
  summary: z.string().max(5000).default(""),
  status: questStatusSchema.default("rumor"),
  revealed: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  /** What happened to it in play, session by session, in order. */
  milestones: z.array(questMilestoneSchema).max(100).default([]),
  /** A player's own quest: who wrote it. Absent on the GM's quests. */
  ownerUid: z.string().min(1).optional(),
  /** The character it belongs to, as named when written (« Quête de Thorin »). */
  ownerName: z.string().max(120).optional(),
});
export type Quest = z.infer<typeof questSchema>;

/**
 * `.../liveSessions/{sessionId}/quotes/{quoteId}` — a line someone at the
 * table wants to remember, pinned during the session.
 */
export const sessionQuoteSchema = auditFieldsSchema.extend({
  text: z.string().min(1).max(500),
  /** Who said it: a character, an NPC, a player… free text. */
  speaker: z.string().max(120).optional(),
  authorUid: z.string().min(1),
});
export type SessionQuote = z.infer<typeof sessionQuoteSchema>;

/** Something the party found during a session. */
export const lootItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  quantity: z.number().int().min(1).max(100000).optional(),
  /** Where it was found (a place name, free text). */
  where: z.string().max(160).optional(),
  /** Who took it, when the GM gave it to a player (their character's name). */
  recipient: z.string().max(120).optional(),
});
export type LootItem = z.infer<typeof lootItemSchema>;

/** A note the GM jots during play, stamped with the time it was taken. */
export const quickNoteSchema = z.object({
  at: z.number().int().min(0),
  text: z.string().min(1).max(1000),
});
export type QuickNote = z.infer<typeof quickNoteSchema>;

/** A faction's attitude toward the party, from hostile (−3) to devoted (+3). */
export const reputationSchema = z.number().int().min(-3).max(3);
