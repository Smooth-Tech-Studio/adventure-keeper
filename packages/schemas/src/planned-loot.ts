import { z } from "zod";
import { moneySchema, ZERO_MONEY } from "./character";

/** One planned object: a name and how many (the GM adds details when giving it). */
export const plannedLootItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(100000).default(1),
});
export type PlannedLootItem = z.infer<typeof plannedLootItemSchema>;

/**
 * What an enemy carries or a location hides (« le chef gobelin porte 30 po et
 * une dague »), written when preparing the adventure and found again in the
 * session's « Donner du butin ». GM-only: a location keeps it in its
 * `locationSecrets` doc.
 */
export const plannedLootSchema = z.object({
  items: z.array(plannedLootItemSchema).max(30).default([]),
  money: moneySchema.default(ZERO_MONEY),
});
export type PlannedLoot = z.infer<typeof plannedLootSchema>;
