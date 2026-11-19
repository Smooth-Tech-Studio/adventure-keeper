import { z } from "zod";
import { adventureParticipantLiveUpdateSchema } from "./adventure-participant";
import { sessionCombatSchema } from "./live-session";
import { sessionCombatantSchema } from "./session-combatant";

/**
 * The self-hosted realtime server (`apps/realtime-server`): one **room** per
 * live session holds what moves fast — the combatants (tokens, HP,
 * conditions) and the combat's order — in memory, and relays every change to
 * the connected tabs over a WebSocket. The fog of the hidden places too, while
 * the GM paints it, and the characters' play state (HP, slots, rolls…).
 * Firestore no longer bills a write per token drag or HP click, nor a read
 * per tab. See docs/REALTIME_SERVER.md.
 *
 * Joining takes the session's **member key** (on the session doc, readable by
 * the campaign's members only); acting as the GM takes the **GM key** too (in
 * the GM-only `private/gm` doc). The server never reads Firestore: the keys
 * are the proof. A Firebase ID token says who is speaking.
 */

export { sessionRealtimeSchema, type SessionRealtime } from "./session-realtime";

/** A combatant as the room keeps it: the Firestore shape, timestamps as ISO strings. */
export const roomCombatantSchema = sessionCombatantSchema.extend({
  id: z.string().min(1).max(64),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoomCombatant = z.infer<typeof roomCombatantSchema>;

/** A place's fog, as `mapReveals` holds it: the packed mask and its grid. */
export const roomFogSchema = z.object({
  mask: z.string().max(200_000),
  cols: z.number().int().min(1).max(4000),
  rows: z.number().int().min(1).max(4000),
});
export type RoomFog = z.infer<typeof roomFogSchema>;

/**
 * What a character's participant doc holds that changes in play, as the room
 * keeps it while the session runs: HP and the combat trackers, the spell
 * slots, the rolls. Notes and pending XP stay in Firestore (rare, and read
 * outside the session). The GM's tab copies these back to Firestore every
 * few minutes and at the session's end.
 */
export const roomParticipantLiveSchema = adventureParticipantLiveUpdateSchema.omit({
  notes: true,
  pendingXp: true,
});
export type RoomParticipantLive = z.infer<typeof roomParticipantLiveSchema>;

/** The fields of {@link roomParticipantLiveSchema}: what a write sends to the room. */
export const ROOM_PARTICIPANT_FIELDS = Object.keys(
  roomParticipantLiveSchema.shape,
) as (keyof RoomParticipantLive)[];

/** A participant in the room: its play state, and whose character it is (for the rights). */
export const roomParticipantSchema = roomParticipantLiveSchema.extend({
  playerId: z.string().min(1).max(128),
});
export type RoomParticipant = z.infer<typeof roomParticipantSchema>;

export const roomStateSchema = z.object({
  combatants: z.record(z.string(), roomCombatantSchema),
  combat: sessionCombatSchema.nullable(),
  /** By location id. */
  fog: z.record(z.string(), roomFogSchema),
  /**
   * By character id. Absent from a server older than this: the participants
   * then stay in Firestore.
   */
  participants: z.record(z.string(), roomParticipantSchema).optional(),
});
export type RoomState = z.infer<typeof roomStateSchema>;

/**
 * What may change on a combatant: everything but who it is (its kind, its
 * reference, its player) — the same latitude `firestore.rules` gives.
 */
export const combatantPatchSchema = sessionCombatantSchema
  .omit({
    sessionId: true,
    kind: true,
    refId: true,
    playerId: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();
export type CombatantPatch = z.infer<typeof combatantPatchSchema>;

/** A change asked of the room. */
export const roomOpSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("combatant.add"),
    combatant: roomCombatantSchema.omit({ createdAt: true, updatedAt: true }),
  }),
  z.object({ type: z.literal("combatant.update"), id: z.string(), patch: combatantPatchSchema }),
  z.object({ type: z.literal("combatant.remove"), id: z.string() }),
  z.object({ type: z.literal("combat.set"), combat: sessionCombatSchema.nullable() }),
  /** GM: a place's whole fog, as painted so far. */
  z.object({
    type: z.literal("fog.set"),
    locationId: z.string().min(1).max(64),
    fog: roomFogSchema,
  }),
  /**
   * GM: a participant's play state, as Firestore has it, enters the room. No
   * effect when the room already has it (it is ahead of Firestore then).
   */
  z.object({
    type: z.literal("participant.track"),
    characterId: z.string().min(1).max(128),
    participant: roomParticipantSchema,
  }),
  /** The GM, or the character's own player (all but conditions and exhaustion). */
  z.object({
    type: z.literal("participant.update"),
    characterId: z.string().min(1).max(128),
    patch: roomParticipantLiveSchema,
  }),
  /** GM, on an empty room: start from what Firestore had (the previous session). */
  z.object({
    type: z.literal("seed"),
    combatants: z.array(roomCombatantSchema.omit({ createdAt: true, updatedAt: true })).max(200),
    combat: sessionCombatSchema.nullable(),
    fog: z.record(z.string().min(1).max(64), roomFogSchema).optional(),
  }),
]);
export type RoomOp = z.infer<typeof roomOpSchema>;

/** Client → server. */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    room: z.string().min(1).max(128),
    memberKey: z.string().min(16).max(128),
    gmKey: z.string().min(16).max(128).optional(),
    /** Firebase ID token of the signed-in player. */
    token: z.string().min(1),
  }),
  /** `ref` comes back with an `error`, to tell which change was refused. */
  z.object({ type: z.literal("op"), ref: z.string().max(64).optional(), op: roomOpSchema }),
  z.object({ type: z.literal("ping") }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Server → client. */
export type ServerMessage =
  | { type: "welcome"; uid: string; gm: boolean; empty: boolean; state: RoomState; uids: string[] }
  | { type: "combatant"; combatant: RoomCombatant }
  | { type: "combatant.removed"; id: string }
  | { type: "combat"; combat: RoomState["combat"] }
  | { type: "fog"; locationId: string; fog: RoomFog }
  | { type: "state"; state: RoomState }
  | { type: "participant"; characterId: string; participant: RoomParticipant }
  | { type: "presence"; uids: string[] }
  | { type: "error"; message: string; ref?: string }
  | { type: "pong" };

/** The server's answer to `GET /health`, which the launch dialog uses to test a URL. */
export interface RealtimeHealth {
  ok: true;
  service: "adventure-keeper-realtime";
  version: string;
  /**
   * The public `https://` address of a server running on the GM's own
   * computer (the desktop app, through its tunnel): what players connect to.
   * Absent on a server reached at its own address.
   */
  publicUrl?: string;
}
