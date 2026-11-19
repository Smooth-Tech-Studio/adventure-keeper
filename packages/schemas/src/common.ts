import { z } from "zod";

/**
 * A Firestore `Timestamp`-like value.
 *
 * The Firestore Web SDK hands back `Timestamp` instances, Cloud Functions use
 * the Admin SDK equivalent, and tests / API payloads often use `Date` or ISO
 * strings. We accept all of them so a single schema can be reused everywhere.
 */
export const timestampSchema = z.union([
  z.date(),
  z.string().datetime({ offset: true }),
  z.object({
    seconds: z.number(),
    nanoseconds: z.number(),
  }),
  // Firestore Timestamp instances expose `toDate()` / `toMillis()`.
  z.object({
    toDate: z.custom<() => Date>((value) => typeof value === "function").optional(),
    toMillis: z.custom<() => number>((value) => typeof value === "function").optional(),
  }),
]);

export type Timestamp = z.infer<typeof timestampSchema>;

/**
 * Value written with `serverTimestamp()` before Firestore resolves it, or any
 * of the concrete timestamp representations above.
 */
export const writableTimestampSchema = z.union([timestampSchema, z.null()]);

/** Fields automatically maintained on every stored document. */
export const auditFieldsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AuditFields = z.infer<typeof auditFieldsSchema>;

/** A stored document's data plus its Firestore id. */
export type WithId<T> = T & { id: string };

/**
 * Wraps a document-data schema with the Firestore document id so a hydrated
 * entity (`{ id, ...data }`) can be validated in one call.
 */
export function withId<Schema extends z.ZodType>(schema: Schema) {
  return z.intersection(z.object({ id: z.string().min(1) }), schema);
}

/** Every top-level and nested collection name, in one place. */
export const COLLECTIONS = {
  users: "users",
  characters: "characters",
  campaigns: "campaigns",
  members: "members",
  invites: "invites",
  contentPacks: "contentPacks",
  campaignPacks: "packs",
  adventures: "adventures",
  locations: "locations",
  locationSecrets: "locationSecrets",
  enemies: "enemies",
  npcs: "npcs",
  events: "events",
  participants: "participants",
  liveSessions: "liveSessions",
  combatants: "combatants",
  mapReveals: "mapReveals",
  notes: "notes",
  chapters: "chapters",
  journal: "journal",
  resources: "resources",
  codex: "codex",
  quests: "quests",
  quotes: "quotes",
  lootOffers: "lootOffers",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Typed helpers for building Firestore document / collection paths. */
export const paths = {
  users: () => COLLECTIONS.users,
  user: (uid: string) => `${COLLECTIONS.users}/${uid}`,

  campaigns: () => COLLECTIONS.campaigns,
  campaign: (campaignId: string) => `${COLLECTIONS.campaigns}/${campaignId}`,

  members: (campaignId: string) => `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.members}`,
  member: (campaignId: string, uid: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.members}/${uid}`,

  characters: () => COLLECTIONS.characters,
  character: (characterId: string) => `${COLLECTIONS.characters}/${characterId}`,

  adventures: (campaignId: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.adventures}`,
  adventure: (campaignId: string, adventureId: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.adventures}/${adventureId}`,

  locations: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.locations}`,
  locationSecrets: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.locationSecrets}`,
  enemies: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.enemies}`,
  npcs: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.npcs}`,
  events: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.events}`,
  participants: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.participants}`,
  participant: (campaignId: string, adventureId: string, characterId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.participants}/${characterId}`,

  liveSessions: (campaignId: string, adventureId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.liveSessions}`,
  liveSession: (campaignId: string, adventureId: string, sessionId: string) =>
    `${paths.adventure(campaignId, adventureId)}/${COLLECTIONS.liveSessions}/${sessionId}`,
  combatants: (campaignId: string, adventureId: string, sessionId: string) =>
    `${paths.liveSession(campaignId, adventureId, sessionId)}/${COLLECTIONS.combatants}`,
  combatant: (campaignId: string, adventureId: string, sessionId: string, combatantId: string) =>
    `${paths.liveSession(campaignId, adventureId, sessionId)}/${COLLECTIONS.combatants}/${combatantId}`,
  mapReveals: (campaignId: string, adventureId: string, sessionId: string) =>
    `${paths.liveSession(campaignId, adventureId, sessionId)}/${COLLECTIONS.mapReveals}`,
  mapReveal: (campaignId: string, adventureId: string, sessionId: string, locationId: string) =>
    `${paths.liveSession(campaignId, adventureId, sessionId)}/${COLLECTIONS.mapReveals}/${locationId}`,

  notes: (campaignId: string) => `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.notes}`,
  note: (campaignId: string, noteId: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.notes}/${noteId}`,

  resources: (campaignId: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.resources}`,
  resource: (campaignId: string, resourceId: string) =>
    `${COLLECTIONS.campaigns}/${campaignId}/${COLLECTIONS.resources}/${resourceId}`,
} as const;
