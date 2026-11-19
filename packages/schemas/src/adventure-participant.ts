import { z } from "zod";
import { conditionSchema, monsterIdSchema, spellIdSchema } from "@adventure-keeper/system-dnd2024";
import { auditFieldsSchema } from "./common";

/** Death-save tally (3 successes = stable, 3 failures = dead). */
export const deathSavesSchema = z.object({
  successes: z.number().int().min(0).max(3),
  failures: z.number().int().min(0).max(3),
});
export type DeathSaves = z.infer<typeof deathSavesSchema>;

/**
 * `campaigns/{campaignId}/adventures/{adventureId}/participants/{characterId}` —
 * a character taking part in the adventure. The document id is the character id.
 *
 * This doc only holds **adventure-scoped play state**: hit points and the live
 * combat trackers (temp HP, death saves, concentration, spell slots spent,
 * conditions…), the GM's pending XP award, and free session notes. Equipment and
 * inventory are NOT copied here — the live session reads and writes them on the
 * character sheet (`characters/{characterId}`), which the player owns.
 */
/** A roll the player made in session, kept for them and shown to the GM. */
export const participantRollSchema = z.object({
  label: z.string().min(1).max(160),
  total: z.number().int().min(-100).max(1000),
  /** The dice and bonuses, as the roll sheet wrote them. */
  detail: z.string().max(300),
  /** When it was rolled, in ms since the epoch. */
  at: z.number().int().min(0),
});
export type ParticipantRoll = z.infer<typeof participantRollSchema>;

/** How many rolls a participant keeps, newest first. */
export const PARTICIPANT_ROLLS_KEPT = 20;

export const adventureParticipantSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  characterId: z.string().min(1),
  /** uid of the player controlling the character (GM for NPCs). */
  playerId: z.string().min(1),
  /** Denormalised for roster lists. */
  characterName: z.string().min(1).max(120),
  currentHitPoints: z.number().int().optional(),
  notes: z.string().max(5000).optional(),
  /**
   * XP the GM awarded during this adventure, waiting for the player to fold it
   * into their character sheet ("Encaisser"). Reset to 0 on cash-in.
   */
  pendingXp: z.number().int().min(0).optional(),

  // --- Live combat trackers (player-written) -----------------------------
  /** Temporary hit points — a separate pool, not healed by rests. */
  temporaryHitPoints: z.number().int().min(0).optional(),
  /** Death-save tally while at 0 HP. */
  deathSaves: deathSavesSchema.optional(),
  /** 2024 Heroic Inspiration held. */
  heroicInspiration: z.boolean().optional(),
  /** The spell currently concentrated on, or null / absent when none. */
  concentration: z
    .object({ spellId: spellIdSchema.optional(), label: z.string().min(1).max(120) })
    .nullable()
    .optional(),
  /** Spell slots spent, keyed by spell level (`"1"`–`"9"`) or `"pact"`. */
  spellSlotsUsed: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Hit dice spent since the last long rest. */
  hitDiceUsed: z.number().int().min(0).optional(),
  /** Uses spent of limited class / species features (Second Wind…), keyed by feature id. */
  featureUsesSpent: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Active conditions. */
  conditions: z.array(conditionSchema).max(20).optional(),
  /** Exhaustion level (2024: 0–6, −2 per level to d20 tests). */
  exhaustion: z.number().int().min(0).max(6).optional(),
  /** The druid's Wild Shape: the beast they have become, or null / absent. */
  wildShape: z
    .object({ monsterId: monsterIdSchema, name: z.string().min(1).max(80) })
    .nullable()
    .optional(),
  /**
   * The initiative the player rolled from their sheet, waiting for the GM's
   * next fight (the combat setup reads it); cleared once that fight starts.
   */
  initiativeRoll: z.number().int().min(-10).max(60).nullable().optional(),
  /** The last rolls, newest first: the player's history, and the GM's « Jets » tab. */
  rolls: z.array(participantRollSchema).max(PARTICIPANT_ROLLS_KEPT).optional(),
});
export type AdventureParticipant = z.infer<typeof adventureParticipantSchema>;

export const adventureParticipantCreateSchema = adventureParticipantSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureParticipantCreate = z.infer<typeof adventureParticipantCreateSchema>;

/** Everything a client may write on a participant doc during play (GM or player). */
export const adventureParticipantLiveUpdateSchema = adventureParticipantSchema
  .pick({
    currentHitPoints: true,
    notes: true,
    pendingXp: true,
    temporaryHitPoints: true,
    deathSaves: true,
    heroicInspiration: true,
    concentration: true,
    spellSlotsUsed: true,
    hitDiceUsed: true,
    featureUsesSpent: true,
    conditions: true,
    exhaustion: true,
    initiativeRoll: true,
    wildShape: true,
    rolls: true,
  })
  .partial();
export type AdventureParticipantLiveUpdate = z.infer<typeof adventureParticipantLiveUpdateSchema>;

/**
 * The subset a **player** edits on their own participant doc. `conditions` and
 * `exhaustion` are left out — those are set by the GM and shown read-only.
 */
export const adventureParticipantPlayerUpdateSchema = adventureParticipantLiveUpdateSchema.omit({
  conditions: true,
  exhaustion: true,
});
export type AdventureParticipantPlayerUpdate = z.infer<
  typeof adventureParticipantPlayerUpdateSchema
>;
