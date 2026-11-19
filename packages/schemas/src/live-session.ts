import { z } from "zod";
import { sessionRealtimeSchema } from "./session-realtime";
import { auditFieldsSchema, timestampSchema } from "./common";
import { shownDocumentSchema } from "./codex";
import { lootItemSchema, quickNoteSchema } from "./quest";
import { localized } from "@adventure-keeper/locale";

export const liveSessionStatusSchema = z.enum(["live", "ended"]);
export type LiveSessionStatus = z.infer<typeof liveSessionStatusSchema>;

export const LIVE_SESSION_STATUS_LABELS: Record<LiveSessionStatus, string> = localized({
  fr: {
    live: "En direct",
    ended: "Terminée",
  },
  en: {
    live: "Live",
    ended: "Ended",
  },
});

/** A live session is active while it is `live` (there is no "paused" state). */
export const ACTIVE_LIVE_SESSION_STATUSES: LiveSessionStatus[] = ["live"];

/** Turn-based combat state carried on the session while a fight is running. */
export const sessionCombatSchema = z.object({
  round: z.number().int().min(1),
  turnIndex: z.number().int().min(0),
  /** Combatant ids, sorted by initiative (descending). */
  order: z.array(z.string().min(1)).max(50),
});
export type SessionCombat = z.infer<typeof sessionCombatSchema>;

/**
 * A story beat revealed during the session, snapshot so the chronicle stays
 * readable once players lose access to the adventure's `events`.
 */
export const revealedEventSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(5000).optional(),
});
export type RevealedEvent = z.infer<typeof revealedEventSchema>;

/** An enemy that fell during the session — kept for the recap once the fight is over. */
export const defeatedEnemySchema = z.object({
  /** The combatant's id: an enemy counts once, however often it is recorded. */
  id: z.string().min(1),
  name: z.string().min(1).max(160),
});
export type DefeatedEnemy = z.infer<typeof defeatedEnemySchema>;

/**
 * `campaigns/{campaignId}/adventures/{adventureId}/liveSessions/{sessionId}` —
 * a real-time play session the GM runs for an adventure. Players join it and see
 * the session screen; live character state (HP, notes) lives on the matching
 * `AdventureParticipant`.
 */
export const liveSessionSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  status: liveSessionStatusSchema.default("live"),
  startedBy: z.string().min(1),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  /** Adventure location whose map the GM is showing. */
  currentLocationId: z.string().min(1).optional(),
  /**
   * Ids of every location the GM has shown during the session, in first-visit
   * order. Drives the "lieux visités" history on the adventure page.
   */
  visitedLocationIds: z.array(z.string().min(1)).max(200).default([]),
  /** In-game clock label the GM sets, e.g. "14:00". */
  clockLabel: z.string().max(20).optional(),
  /** In-game date, free text (« 12 du mois des Brumes »), carried to the next session. */
  gameDate: z.string().max(80).optional(),
  /**
   * In-game day counter (« Jour 3 »): goes up when the GM's clock passes
   * midnight, carried to the next session. Events can be due on it.
   */
  gameDay: z.number().int().min(1).max(100000).optional(),
  /** What the party found during the session. */
  loot: z.array(lootItemSchema).max(200).default([]),
  /** Rank of the session within the adventure (Séance 1, 2…), set at start. */
  number: z.number().int().min(1).optional(),
  /** Title the GM gives the session when publishing its recap. */
  title: z.string().max(160).optional(),
  /**
   * The **published** recap (Markdown), read by every member. The GM's draft
   * lives in the GM-only `private/gm` doc and is copied here on publish.
   */
  recap: z.string().max(20000).optional(),
  recapPublishedAt: timestampSchema.optional(),
  /** Enemies that fell during the session, in order. */
  defeated: z.array(defeatedEnemySchema).max(500).default([]),
  /** Story beats the GM revealed during this session, in reveal order. */
  revealedEvents: z.array(revealedEventSchema).max(100).default([]),
  /** The handout every screen shows right now, if any. */
  shownDocument: shownDocumentSchema.optional(),
  /** Every handout shown during this session, in order (for the chronicle). */
  shownDocuments: z.array(shownDocumentSchema).max(100).default([]),
  /** Journal entries the GM keeps out of this session's chronicle. */
  hiddenEntryIds: z.array(z.string().min(1)).max(200).default([]),
  /** uids who joined at some point (unlike `connectedUids`, never shrinks). */
  attendeeUids: z.array(z.string().min(1)).max(50).default([]),
  /** Turn-based combat, absent when no fight is running. */
  combat: sessionCombatSchema.optional(),
  /**
   * Played through a self-hosted realtime server: the combatants and the combat
   * live in its room (`realtime.ts`), not in Firestore. Absent = Firestore.
   */
  realtime: sessionRealtimeSchema.optional(),
  /** uids currently connected to the session. */
  connectedUids: z.array(z.string().min(1)).max(50).default([]),
});
export type LiveSession = z.infer<typeof liveSessionSchema>;

export const liveSessionCreateSchema = liveSessionSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type LiveSessionCreate = z.infer<typeof liveSessionCreateSchema>;

/** Sub-collection and doc id of the GM-only companion of a live session. */
export const LIVE_SESSION_PRIVATE_COLLECTION = "private";
export const LIVE_SESSION_GM_DOC_ID = "gm";

/**
 * `.../liveSessions/{sessionId}/private/gm` — what only the GM reads: the
 * recap draft (published by copying it onto the session) and notes on what
 * the players did not see.
 */
export const liveSessionGmSchema = auditFieldsSchema.extend({
  titleDraft: z.string().max(160).optional(),
  recapDraft: z.string().max(20000).optional(),
  gmNotes: z.string().max(20000).optional(),
  /** Notes jotted during play, oldest first — offered again when writing the recap. */
  quickNotes: z.array(quickNoteSchema).max(300).default([]),
  /** The realtime room's GM key (see `session.realtime`): who holds it acts as the GM. */
  realtimeGmKey: z.string().min(16).max(128).optional(),
});
export type LiveSessionGm = z.infer<typeof liveSessionGmSchema>;

/** A session's display number: the stored one, else its rank by start time. */
export function sessionNumbers<T extends { id: string; number?: number; startedAt?: unknown }>(
  sessions: T[],
  toMillis: (value: unknown) => number,
): Map<string, number> {
  const sorted = [...sessions].sort((a, b) => toMillis(a.startedAt) - toMillis(b.startedAt));
  return new Map(sorted.map((s, i) => [s.id, s.number ?? i + 1]));
}
