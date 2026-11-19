import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { moneySchema, ZERO_MONEY } from "./character";
import { itemSchema } from "./item";

/** Where a given item goes on the sheet. */
export const lootOfferSectionSchema = z.enum(["weapons", "armors", "tools", "inventory"]);
export type LootOfferSection = z.infer<typeof lootOfferSectionSchema>;

export const LOOT_OFFER_STATUSES = ["pending", "accepted", "declined"] as const;
export type LootOfferStatus = (typeof LOOT_OFFER_STATUSES)[number];

/**
 * `campaigns/{c}/adventures/{a}/liveSessions/{s}/lootOffers/{id}` — what the GM
 * gives one player during the session: items and/or coins. The player accepts
 * (the items go to their bag, the coins to their purse) or declines; the GM
 * then logs it in the session's loot.
 */
export const lootOfferSchema = auditFieldsSchema.extend({
  /** The player who receives it — the only one, with the GM, to read it. */
  toUid: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1).max(120),
  items: z
    .array(z.object({ section: lootOfferSectionSchema, item: itemSchema }))
    .max(50)
    .default([]),
  money: moneySchema.default(ZERO_MONEY),
  /**
   * Codex entries (objects) among the items: the GM's client reveals them once
   * the offer is accepted — a player cannot write the codex.
   */
  codexEntryIds: z.array(z.string().min(1)).max(50).default([]),
  /** Where it was found (free text). */
  where: z.string().max(160).optional(),
  status: z.enum(LOOT_OFFER_STATUSES),
  /** The GM wrote it in the session's loot (once accepted). */
  logged: z.boolean().optional(),
});
export type LootOffer = z.infer<typeof lootOfferSchema>;
