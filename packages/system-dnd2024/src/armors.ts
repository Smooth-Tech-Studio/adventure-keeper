import { z } from "zod";
import { localized } from "./locale";

/**
 * 5e 2024 armour **types and rules helpers**. The armour *data* is not bundled
 * with the engine — it lives in the SRD pack's `srd/armors.json`, which the
 * app loads on demand (`SRD_CATALOGS`), the same pattern used for spells. Only names + numbers are modelled, no rules text.
 *
 * Ref: SRD 5.2 (CC-BY-4.0) armour table.
 */

export const ARMOR_CATEGORIES = ["light", "medium", "heavy", "shield"] as const;
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];
export const armorCategorySchema = z.enum(ARMOR_CATEGORIES);

export const ARMOR_CATEGORY_LABELS: Record<ArmorCategory, string> = localized({
  fr: {
    light: "Armure légère",
    medium: "Armure intermédiaire",
    heavy: "Armure lourde",
    shield: "Bouclier",
  },
  en: {
    light: "Light armor",
    medium: "Medium armor",
    heavy: "Heavy armor",
    shield: "Shield",
  },
});

/** A catalogue entry (shape of every row in `armors.json`). */
export interface ArmorDef {
  id: string;
  name: string;
  category: ArmorCategory;
  /** Price in copper pieces. */
  priceCp: number;
  weightKg: number;
  /** Base AC for body armour (light / medium / heavy). */
  baseAc?: number;
  /** Flat AC bonus for a shield. */
  acBonus?: number;
  /** Whether the Dex modifier is added to AC (light: full, medium: capped, heavy: no). */
  addsDex: boolean;
  /** Cap on the Dex contribution (medium armour = 2). */
  maxDex?: number;
  /** Minimum Strength score; below it, Speed drops by 10 ft. */
  strengthMin?: number;
  /** Disadvantage on Dexterity (Stealth) checks. */
  stealthDisadvantage: boolean;
  /**
   * What the thing physically *is* — « Broigne » and « Clibanion » mean nothing
   * to most players. The numbers above say what it does. Our words, never
   * rulebook prose.
   */
  description?: string;
}

/**
 * The subset of an {@link ArmorDef} stored on a character's armour item. Carries
 * everything the rules engine needs so it never has to load the catalogue.
 */
export const armorPropsSchema = z.object({
  category: armorCategorySchema,
  baseAc: z.number().int().optional(),
  acBonus: z.number().int().optional(),
  addsDex: z.boolean().default(false),
  maxDex: z.number().int().optional(),
  strengthMin: z.number().int().optional(),
  stealthDisadvantage: z.boolean().default(false),
});
export type ArmorProps = z.infer<typeof armorPropsSchema>;

/** Turn a catalogue entry into the stored props block. */
export function armorPropsFromDef(def: ArmorDef): ArmorProps {
  return {
    category: def.category,
    baseAc: def.baseAc,
    acBonus: def.acBonus,
    addsDex: def.addsDex,
    maxDex: def.maxDex,
    strengthMin: def.strengthMin,
    stealthDisadvantage: def.stealthDisadvantage,
  };
}

/** Human-readable AC formula, e.g. `14 + Dex (max 2)`, `18`, `+2`. */
export function armorClassFormula(
  armor: Pick<ArmorProps, "category" | "baseAc" | "acBonus" | "addsDex" | "maxDex">,
): string {
  if (armor.category === "shield") return `+${armor.acBonus ?? 2}`;
  const base = armor.baseAc ?? 10;
  if (!armor.addsDex) return `${base}`;
  if (armor.maxDex != null) return `${base} + Dex (max ${armor.maxDex})`;
  return `${base} + Dex`;
}

export interface ResolvedArmorClass {
  armorClass: number;
  /** The body armour that set the base, if any. */
  body?: ArmorProps;
  /** The shield adding its bonus, if any. */
  shield?: ArmorProps;
}

/**
 * Armour Class from the equipped armour pieces.
 *
 * - no body armour → `10 + Dex`
 * - light → `base + Dex`
 * - medium → `base + min(Dex, maxDex ?? 2)`
 * - heavy → `base` (no Dex)
 * - a shield adds its flat bonus on top.
 *
 * If several body pieces are passed the first wins (the UI keeps one equipped).
 * `unarmoredBase` replaces the 10 when no body armour is worn (Armure du mage: 13).
 */
export function resolveArmorClass(
  dexMod: number,
  equipped: ArmorProps[],
  opts: { unarmoredBase?: number } = {},
): ResolvedArmorClass {
  const body = equipped.find((a) => a.category !== "shield");
  const shield = equipped.find((a) => a.category === "shield");

  let armorClass = (opts.unarmoredBase ?? 10) + dexMod;
  if (body) {
    const base = body.baseAc ?? 10;
    if (!body.addsDex) armorClass = base;
    else if (body.maxDex != null) armorClass = base + Math.min(dexMod, body.maxDex);
    else armorClass = base + dexMod;
  }
  if (shield) armorClass += shield.acBonus ?? 2;

  return { armorClass, body, shield };
}
