import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { plannedLootSchema } from "./planned-loot";

const mapPointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/**
 * The map's scale, measured when the location is set up: two points on the
 * image (fractions of its width and height) and the real distance between
 * them. `widthMetres` — the image's width on the ground — follows from them,
 * and the squares (1,5 m) and the tokens' sizes from it. The points are kept
 * so the measure can be shown and redone.
 */
export const mapScaleSchema = z.object({
  from: mapPointSchema,
  to: mapPointSchema,
  /** Distance between the two points, in metres. */
  metres: z.number().positive().max(100_000),
  /** The image's width in metres, computed from the above. */
  widthMetres: z.number().positive().max(10_000_000),
});
export type MapScale = z.infer<typeof mapScaleSchema>;

/**
 * A place in the adventure, with a map image — as the GM's app holds it.
 *
 * Stored in two documents sharing the same id, because Firestore rules grant
 * read per document, not per field:
 * - `locations/{locationId}`: what players may read once the adventure is live —
 *   `name`, `hidden`, `order`, and `imageUrl` **only while the location is not
 *   hidden**. `description` and `storagePath` are never stored there.
 * - `locationSecrets/{locationId}` (GM-only, {@link adventureLocationSecretSchema}):
 *   `description`, `storagePath` and the full `imageUrl`, hidden or not.
 *
 * Documents written before the split may still carry the secret fields on the
 * public doc; the GM's client moves them on load.
 */
export const adventureLocationSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  name: z.string().min(1).max(160),
  /** GM-only notes about the place (never shown to players). */
  description: z.string().max(5000).optional(),
  /** URL of the map / illustration image. Optional. */
  imageUrl: z.string().url().optional(),
  /** Cloud Storage path when the image was uploaded through the app. */
  storagePath: z.string().min(1).optional(),
  /**
   * When on, the location is hidden from players in a live session until the GM
   * reveals its map bit by bit with the eraser (`mapReveals` subcollection).
   */
  hidden: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  /** The map's scale, public (players draw the tokens with it), hidden or not. */
  scale: mapScaleSchema.optional(),
  /** GM-only planned loot: lives in `locationSecrets`, merged in on the GM's side. */
  loot: plannedLootSchema.optional(),
});
export type AdventureLocation = z.infer<typeof adventureLocationSchema>;

export const adventureLocationCreateSchema = adventureLocationSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type AdventureLocationCreate = z.infer<typeof adventureLocationCreateSchema>;

/**
 * `campaigns/{c}/adventures/{a}/locationSecrets/{locationId}` — the GM-only
 * half of a location (see {@link adventureLocationSchema}). Same id as the
 * public location doc.
 */
export const adventureLocationSecretSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  adventureId: z.string().min(1),
  description: z.string().max(5000).optional(),
  /** The map's URL, whether or not the location is hidden. */
  imageUrl: z.string().url().optional(),
  storagePath: z.string().min(1).optional(),
  /** What the place hides, ready to give in a session. */
  loot: plannedLootSchema.optional(),
});
export type AdventureLocationSecret = z.infer<typeof adventureLocationSecretSchema>;
