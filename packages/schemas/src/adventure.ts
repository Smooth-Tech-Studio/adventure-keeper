import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { localized } from "@adventure-keeper/locale";

/**
 * Lifecycle set by the GM:
 * - `draft`     — being prepared; GM-only, hidden from players, not playable
 * - `upcoming`  — planned, participating players see the title
 * - `active`    — being played (auto-set when a live session starts)
 * - `completed` — finished; players may read it fully
 *
 * "En direct" is not a stored status: it is shown whenever `liveSessionId` is
 * set (see `adventureDisplayStatus`).
 */
export const adventureStatusSchema = z.enum(["draft", "upcoming", "active", "completed"]);
export type AdventureStatus = z.infer<typeof adventureStatusSchema>;

export const ADVENTURE_STATUS_LABELS: Record<AdventureStatus, string> = localized({
  fr: {
    draft: "Brouillon",
    upcoming: "À venir",
    active: "En cours",
    completed: "Terminée",
  },
  en: {
    draft: "Draft",
    upcoming: "Upcoming",
    active: "In progress",
    completed: "Completed",
  },
});

/** Status shown in lists, including the transient "live" state. */
export type AdventureDisplayStatus = AdventureStatus | "live";

export const ADVENTURE_DISPLAY_STATUS_LABELS: Record<AdventureDisplayStatus, string> = localized({
  fr: {
    draft: "Brouillon",
    upcoming: "À venir",
    active: "En cours",
    completed: "Terminée",
    live: "En direct",
  },
  en: {
    draft: "Draft",
    upcoming: "Upcoming",
    active: "In progress",
    completed: "Completed",
    live: "Live",
  },
});

/**
 * `campaigns/{campaignId}/adventures/{adventureId}` — a scenario run by the GM
 * inside a campaign. Holds locations, enemies, NPCs, key events and the roster
 * of participating characters as subcollections.
 */
export const adventureSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  createdBy: z.string().min(1),
  title: z.string().min(1).max(160),
  summary: z.string().max(5000).optional(),
  status: adventureStatusSchema.default("draft"),
  /** Id of the live session currently running for this adventure, if any. */
  liveSessionId: z.string().min(1).optional(),
  /**
   * Set to `true` the first time a live session is started. Once an adventure
   * has been played it can never go back to "brouillon" (draft).
   */
  hasPlayedSession: z.boolean().default(false),
  /**
   * uids of the players whose character takes part. Denormalised from the
   * `participants` subcollection so the campaign screen (and Firestore rules)
   * can show an adventure only to those who are in it.
   */
  playerIds: z.array(z.string().min(1)).max(50).default([]),
  /** Display order within the campaign. */
  order: z.number().int().min(0).default(0),
  /**
   * When on, the GM tracks conditions & exhaustion on each participant and
   * players see them (read-only). Off by default — keeps simple games simple.
   */
  conditionsEnabled: z.boolean().default(false),
  /**
   * Where the game clock starts: the first live session opens on this day,
   * time (`HH:MM`) and in-world date. Later sessions resume where the previous
   * one stopped.
   */
  startDay: z.number().int().min(1).max(100000).optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  startDate: z.string().max(80).optional(),
  /**
   * When the GM last published a session recap (ms since epoch). Lets the
   * campaign screen flag a recap the player has not read yet.
   */
  lastRecapAt: z.number().int().min(0).optional(),
});
export type Adventure = z.infer<typeof adventureSchema>;

/** `"live"` when a session is running, otherwise the stored status. */
export function adventureDisplayStatus(adventure: {
  status: AdventureStatus;
  liveSessionId?: string;
}): AdventureDisplayStatus {
  return adventure.liveSessionId ? "live" : adventure.status;
}

/** Whether a campaign member (non-GM) is allowed to open the adventure's content. */
export function playerCanReadAdventure(adventure: {
  status: AdventureStatus;
  liveSessionId?: string;
}): boolean {
  return adventure.status === "completed" || Boolean(adventure.liveSessionId);
}

/**
 * Whether a participating player may even see the adventure exists. Drafts are
 * GM-only; everything else is visible to players in the roster.
 */
export function playerCanSeeAdventure(adventure: { status: AdventureStatus }): boolean {
  return adventure.status !== "draft";
}

/** A live session can only be started once the adventure has left "brouillon". */
export function adventureIsPlayable(adventure: { status: AdventureStatus }): boolean {
  return adventure.status !== "draft";
}

/**
 * Whether the adventure may be put back to "brouillon". Forbidden once it has
 * been played (a session was started, or one is running right now) — draft is
 * for preparation only.
 */
export function adventureCanReturnToDraft(adventure: {
  hasPlayedSession?: boolean;
  liveSessionId?: string;
}): boolean {
  return !adventure.hasPlayedSession && !adventure.liveSessionId;
}

export const adventureCreateSchema = adventureSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureCreate = z.infer<typeof adventureCreateSchema>;

export const adventureUpdateSchema = adventureSchema
  .omit({ createdAt: true, updatedAt: true, campaignId: true, createdBy: true })
  .partial();
export type AdventureUpdate = z.infer<typeof adventureUpdateSchema>;
