import { z } from "zod";
import { auditFieldsSchema } from "./common";

/**
 * - `private`  — only the author.
 * - `gm`       — the author and the campaign owner (GM).
 * - `campaign` — every campaign member.
 */
export const noteVisibilitySchema = z.enum(["private", "gm", "campaign"]);
export type NoteVisibility = z.infer<typeof noteVisibilitySchema>;

/**
 * `campaigns/{campaignId}/notes/{noteId}` — a lore / plot / rules note.
 */
export const noteSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  authorId: z.string().min(1),
  title: z.string().min(1).max(160),
  /** Markdown body. */
  body: z.string().max(50000).default(""),
  visibility: noteVisibilitySchema.default("campaign"),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  pinned: z.boolean().default(false),
  /** Optional link back to the session this note came out of. */
  sessionId: z.string().min(1).optional(),
});

export type Note = z.infer<typeof noteSchema>;

export const noteCreateSchema = noteSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type NoteCreate = z.infer<typeof noteCreateSchema>;

export const noteUpdateSchema = noteSchema
  .omit({ createdAt: true, updatedAt: true, campaignId: true, authorId: true })
  .partial();

export type NoteUpdate = z.infer<typeof noteUpdateSchema>;
