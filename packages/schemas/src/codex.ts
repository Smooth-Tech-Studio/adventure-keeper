import { z } from "zod";
import { auditFieldsSchema, timestampSchema } from "./common";
import { reputationSchema } from "./quest";

export const CODEX_KINDS = [
  "npc",
  "place",
  "faction",
  "item",
  "deity",
  "document",
  "other",
] as const;
export const codexKindSchema = z.enum(CODEX_KINDS);
export type CodexKind = z.infer<typeof codexKindSchema>;

/**
 * `campaigns/{campaignId}/codex/{entryId}` — what the party can learn about
 * the world: people, places, factions, objects, gods, documents handed out.
 *
 * This doc only holds what the players may read once it is **revealed**; the
 * GM's secrets live in the GM-only `private/gm` doc. Players list the codex
 * with `where("revealed", "==", true)`.
 */
export const codexEntrySchema = auditFieldsSchema.extend({
  campaignId: z.string().min(1),
  kind: codexKindSchema,
  name: z.string().min(1).max(160),
  /** What the players know (Markdown). */
  summary: z.string().max(20000).default(""),
  /** Portrait, illustration, or the handout itself. */
  imageUrl: z.string().url().optional(),
  /** A document hosted elsewhere (handout as a PDF, a link…). */
  url: z.string().url().optional(),
  revealed: z.boolean().default(false),
  /** A faction's attitude toward the party (−3…+3), shown with the entry. */
  reputation: reputationSchema.optional(),
  revealedAt: timestampSchema.optional(),
  /** Adventure it belongs to, if any (purely informative). */
  adventureId: z.string().min(1).optional(),
  /** Created from an adventure NPC / location: their ids, for de-duplication. */
  sourceNpcId: z.string().min(1).optional(),
  sourceLocationId: z.string().min(1).optional(),
});
export type CodexEntry = z.infer<typeof codexEntrySchema>;

/** `.../codex/{entryId}/private/gm` — the GM's secrets about the entry. */
export const codexEntryGmSchema = auditFieldsSchema.extend({
  secret: z.string().max(20000).optional(),
});
export type CodexEntryGm = z.infer<typeof codexEntryGmSchema>;

/** Codex id of the entry made for an adventure location (one per location). */
export const codexLocationEntryId = (locationId: string) => `loc-${locationId}`;

/** A handout shown during a session, snapshot for the chronicle. */
export const shownDocumentSchema = z.object({
  entryId: z.string().min(1),
  name: z.string().min(1).max(160),
  imageUrl: z.string().url().optional(),
  url: z.string().url().optional(),
  /** The place on screen when it was handed out (« Trouvé : le cimetière »). */
  foundAt: z.string().max(160).optional(),
});
export type ShownDocument = z.infer<typeof shownDocumentSchema>;

/**
 * `[[Nom]]` mentions in a text, as written (trimmed). Used to link recaps,
 * journals and codex entries to each other.
 */
export function codexMentions(text: string): string[] {
  return [...text.matchAll(/\[\[([^[\]\n]{1,160})\]\]/g)].map((m) => m[1]!.trim());
}

/** Lower-case, accent-less key so `[[garrick]]` finds « Garrick ». */
export function codexKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
