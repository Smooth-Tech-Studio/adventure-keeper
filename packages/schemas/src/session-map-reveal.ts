import { z } from "zod";
import { auditFieldsSchema } from "./common";

/**
 * `campaigns/{c}/adventures/{a}/liveSessions/{s}/mapReveals/{locationId}` —
 * how much of a hidden location's map the GM has uncovered during a session.
 *
 * The uncovered area is a **raster mask**: a `cols × rows` grid of cells (cells
 * are square in image space, so the eraser stays a true circle whatever the
 * image ratio), packed bit-per-cell (`1` = revealed) into a base64 string. The
 * GM edits it locally and commits the whole mask when releasing the tool.
 *
 * The location's `name` / `imageUrl` / `hidden` are snapshot here so the "lieux
 * visités" history stays readable even after the session ends and players lose
 * access to the `locations` subcollection.
 */
export const sessionMapRevealSchema = auditFieldsSchema.extend({
  sessionId: z.string().min(1),
  locationId: z.string().min(1),
  /** Snapshot of the location at first visit. */
  name: z.string().min(1).max(160),
  imageUrl: z.string().url().optional(),
  hidden: z.boolean().default(false),
  /** Base64 of the packed reveal bitmask (bit set = cell revealed). */
  mask: z.string().max(200_000).optional(),
  /** Grid dimensions the mask was painted at. */
  cols: z.number().int().min(1).max(4000).optional(),
  rows: z.number().int().min(1).max(4000).optional(),
});
export type SessionMapReveal = z.infer<typeof sessionMapRevealSchema>;

export const sessionMapRevealCreateSchema = sessionMapRevealSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type SessionMapRevealCreate = z.infer<typeof sessionMapRevealCreateSchema>;
