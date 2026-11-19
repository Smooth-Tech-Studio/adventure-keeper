import { z } from "zod";
import {
  armorPropsSchema,
  toolPropsSchema,
  weaponPropsSchema,
} from "@adventure-keeper/system-dnd2024";

/**
 * A generic inventory entry — used for weapons, armour, tools and free
 * inventory lines. Every item has a name, an optional lore blurb and a
 * quantity. Items created from the 5e equipment catalogue also carry the
 * structured block their category needs (`weapon` / `armor` / `tool`), a
 * `catalogId` back-reference, and their price / weight.
 */
export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  lore: z.string().max(2000).optional(),
  /**
   * A consumable has a quantity the player adjusts on the fly. A
   * non-consumable is a single, unique object (quantity stays 1).
   */
  consumable: z.boolean().default(false),
  quantity: z.number().int().min(1).max(100000).default(1),
  /** Id of the catalogue entry this item was created from, if any. */
  catalogId: z.string().max(80).optional(),
  /** Price in copper pieces (from the catalogue). */
  priceCp: z.number().int().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  /** Weapon stats — present on catalogue weapons. */
  weapon: weaponPropsSchema.optional(),
  /** Armour stats + whether it is currently worn — present on catalogue armour. */
  armor: armorPropsSchema.extend({ equipped: z.boolean().default(false) }).optional(),
  /** Tool stats — present on catalogue tools. */
  tool: toolPropsSchema.optional(),
});
export type Item = z.infer<typeof itemSchema>;
