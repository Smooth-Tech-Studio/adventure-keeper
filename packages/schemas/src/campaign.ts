import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { characterSystemSchema } from "./character-system";
import { localized } from "@adventure-keeper/locale";

/** Game systems the platform knows about; `custom` covers homebrew rulesets. */
export const gameSystemSchema = z.enum([
  "dnd5e",
  "pathfinder2e",
  "callOfCthulhu",
  "starfinder",
  "worldOfDarkness",
  "custom",
  "other",
]);

export type GameSystem = z.infer<typeof gameSystemSchema>;

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = localized({
  fr: {
    dnd5e: "Compatible 5E (2024)",
    pathfinder2e: "Pathfinder 2e",
    callOfCthulhu: "L'Appel de Cthulhu",
    starfinder: "Starfinder",
    worldOfDarkness: "Monde des Ténèbres",
    custom: "Système maison",
    other: "Autre",
  },
  en: {
    dnd5e: "5E compatible (2024)",
    pathfinder2e: "Pathfinder 2e",
    callOfCthulhu: "Call of Cthulhu",
    starfinder: "Starfinder",
    worldOfDarkness: "World of Darkness",
    custom: "Homebrew system",
    other: "Other",
  },
});

/**
 * `campaigns/{campaignId}` — the top-level container for a group's game.
 *
 * `memberIds` is a denormalised list of every member uid (owner included) so
 * security rules and "my campaigns" queries stay cheap. The authoritative
 * per-member data lives in the `members` subcollection.
 */
export const campaignSchema = auditFieldsSchema.extend({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  system: gameSystemSchema.default("dnd5e"),
  /** Free-text label shown when `system` is `custom` / `other`. */
  systemLabel: z.string().max(80).optional(),
  /**
   * Character rules module this campaign requires — **authoritative** for who
   * can join. A `dnd2024` campaign accepts only `dnd2024` characters; a
   * `standard` campaign accepts `standard` and `dnd2024`.
   */
  characterSystem: characterSystemSchema.default("dnd2024"),
  ownerId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1).max(50),
  coverImageUrl: z.string().url().optional(),
  isArchived: z.boolean().default(false),
});

export type Campaign = z.infer<typeof campaignSchema>;

export const campaignCreateSchema = campaignSchema
  .omit({ createdAt: true, updatedAt: true, isArchived: true, memberIds: true })
  .extend({
    memberIds: z.array(z.string().min(1)).max(50).optional(),
  });

export type CampaignCreate = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignSchema
  .pick({
    name: true,
    description: true,
    system: true,
    systemLabel: true,
    coverImageUrl: true,
    isArchived: true,
  })
  .partial();

export type CampaignUpdate = z.infer<typeof campaignUpdateSchema>;
