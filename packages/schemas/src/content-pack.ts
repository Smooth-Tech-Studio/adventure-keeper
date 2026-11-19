import { z } from "zod";
import { contentPackSchema } from "@adventure-keeper/system-dnd2024";
import { auditFieldsSchema } from "./common";

/**
 * `contentPacks/{docId}` — a pack in its owner's library.
 *
 * The validated pack (`ak-pack/1`, see `docs/CONTENT_PACKS.md`) is stored
 * whole in `pack`; `packId` / `name` / `version` / `entryCount` repeat what
 * lists display. An owner has at most one pack per `packId` (the namespace of
 * its entries) — checked on import, not by the rules.
 *
 * Sharing: `sharedWith` lists accounts that see it in their library (added by
 * the owner, or by themselves through the link while `linkSharing` is on).
 */
export const contentPackDocSchema = auditFieldsSchema.extend({
  ownerId: z.string().min(1),
  ownerName: z.string().min(1).max(80),
  packId: z.string().min(1),
  name: z.string().min(1).max(80),
  version: z.string().min(1),
  entryCount: z.number().int().min(0),
  pack: contentPackSchema,
  sharedWith: z.array(z.string().min(1)).max(100).default([]),
  linkSharing: z.boolean().default(false),
});
export type ContentPackDoc = z.infer<typeof contentPackDocSchema>;

/**
 * `campaigns/{campaignId}/packs/{packId}` — a pack the GM allowed in the
 * campaign, **copied** there when activated: members read it without needing
 * access to the owner's library, and the document id (the pack's namespace)
 * keeps two packs with the same id out of one campaign. The GM refreshes the
 * copy to pick up a newer version.
 */
export const campaignPackSchema = auditFieldsSchema.extend({
  /** The `contentPacks/{docId}` it was copied from. */
  sourceId: z.string().min(1),
  ownerId: z.string().min(1),
  ownerName: z.string().min(1).max(80),
  packId: z.string().min(1),
  name: z.string().min(1).max(80),
  version: z.string().min(1),
  pack: contentPackSchema,
  activatedBy: z.string().min(1),
});
export type CampaignPack = z.infer<typeof campaignPackSchema>;

/** Firestore caps a document at 1 MiB; keep a margin for the other fields. */
export const CONTENT_PACK_MAX_BYTES = 900_000;
