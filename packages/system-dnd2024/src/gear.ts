import { z } from "zod";
import { localized } from "./locale";

/**
 * 5e 2024 adventuring gear **types and helpers**. The gear *data* is not
 * bundled with the engine — it lives in the SRD pack's `srd/gear.json` and
 * `srd/equipment-packs.json`, which the app loads on demand (`SRD_CATALOGS`),
 * the same pattern used for spells. Only names +
 * numbers are modelled, no rules text.
 *
 * Ref: SRD 5.2 (CC-BY-4.0) adventuring gear table.
 */

/** A catalogue entry (shape of every row in `gear.json`). */
export interface GearDef {
  id: string;
  name: string;
  /** Price in copper pieces. */
  priceCp: number;
  weightKg?: number;
  /** Loose grouping for the picker (e.g. "ammunition", "focus", "container"). */
  group?: string;
  /** What the item is for, in our own words (not rulebook prose). */
  description?: string;
}

export interface EquipmentPackEntry {
  gearId: string;
  qty: number;
}

/** A bundled starting pack (shape of every row in `equipment-packs.json`). */
export interface EquipmentPackDef {
  id: string;
  name: string;
  priceCp: number;
  contents: EquipmentPackEntry[];
}

export const gearDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCp: z.number().int().min(0),
  weightKg: z.number().min(0).optional(),
  group: z.string().optional(),
  description: z.string().optional(),
});

export const equipmentPackDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCp: z.number().int().min(0),
  contents: z.array(z.object({ gearId: z.string().min(1), qty: z.number().int().min(1) })),
});

const CP_PER_SP = 10;
const CP_PER_GP = 100;

export const COINS = ["platinum", "gold", "electrum", "silver", "copper"] as const;
export type Coin = (typeof COINS)[number];

export const COIN_LABELS: Record<Coin, string> = localized({
  fr: {
    platinum: "Pièces de platine",
    gold: "Pièces d'or",
    electrum: "Pièces d'électrum",
    silver: "Pièces d'argent",
    copper: "Pièces de cuivre",
  },
  en: {
    platinum: "Platinum pieces",
    gold: "Gold pieces",
    electrum: "Electrum pieces",
    silver: "Silver pieces",
    copper: "Copper pieces",
  },
});

/** « po », "gp" — a coin as written after an amount. */
export const COIN_ABBR: Record<Coin, string> = localized({
  fr: { platinum: "pp", gold: "po", electrum: "pe", silver: "pa", copper: "pc" },
  en: { platinum: "pp", gold: "gp", electrum: "ep", silver: "sp", copper: "cp" },
});

/** Copper amount → `"5 po"`, `"2 pa"`, `"1 po 5 pa"` (in the engine's locale), `"—"` for 0. */
export function formatCoinPrice(priceCp: number): string {
  if (!priceCp) return "—";
  const gp = Math.floor(priceCp / CP_PER_GP);
  const sp = Math.floor((priceCp % CP_PER_GP) / CP_PER_SP);
  const cp = priceCp % CP_PER_SP;
  const parts: string[] = [];
  if (gp) parts.push(`${gp} ${COIN_ABBR.gold}`);
  if (sp) parts.push(`${sp} ${COIN_ABBR.silver}`);
  if (cp) parts.push(`${cp} ${COIN_ABBR.copper}`);
  return parts.join(" ");
}

export const gp = (value: number): number => Math.round(value * CP_PER_GP);
export const sp = (value: number): number => Math.round(value * CP_PER_SP);
export const cp = (value: number): number => Math.round(value);
