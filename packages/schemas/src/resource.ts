import { z } from "zod";
import { auditFieldsSchema } from "./common";

export const resourceKindSchema = z.enum(["link", "image", "map", "handout", "file", "audio"]);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const resourceVisibilitySchema = z.enum(["gm", "campaign"]);
export type ResourceVisibility = z.infer<typeof resourceVisibilitySchema>;

/**
 * `campaigns/{campaignId}/resources/{resourceId}` — a shared asset: an external
 * link, or a file uploaded to Cloud Storage and referenced by `url`.
 */
export const resourceSchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  uploadedBy: z.string().min(1),
  title: z.string().min(1).max(160),
  kind: resourceKindSchema,
  url: z.string().url(),
  /** Cloud Storage path, when the resource is an uploaded file. */
  storagePath: z.string().min(1).optional(),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  description: z.string().max(1000).optional(),
  visibility: resourceVisibilitySchema.default("campaign"),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export type Resource = z.infer<typeof resourceSchema>;

export const resourceCreateSchema = resourceSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type ResourceCreate = z.infer<typeof resourceCreateSchema>;

export const resourceUpdateSchema = resourceSchema
  .omit({ createdAt: true, updatedAt: true, campaignId: true, uploadedBy: true })
  .partial();

export type ResourceUpdate = z.infer<typeof resourceUpdateSchema>;
