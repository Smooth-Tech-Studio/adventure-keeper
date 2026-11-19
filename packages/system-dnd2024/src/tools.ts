import { z } from "zod";
import { abilitySchema, type Ability, type AbilityModifierBlock } from "./abilities";
import { localized } from "./locale";

/**
 * 5e 2024 tool **types and rules helpers**. The tool *data* is not bundled
 * with the engine — it lives in the SRD pack's `srd/tools.json`, which the app
 * loads on demand (`SRD_CATALOGS`), the same pattern used for spells. Only names + numbers are modelled, no rules text.
 *
 * Ref: SRD 5.2 (CC-BY-4.0) tool table.
 */

export const TOOL_CATEGORIES = [
  "artisan",
  "thieves",
  "disguise",
  "forgery",
  "herbalism",
  "poisoner",
  "navigator",
  "instrument",
  "gaming",
  "other",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export const toolCategorySchema = z.enum(TOOL_CATEGORIES);

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = localized({
  fr: {
    artisan: "Outils d'artisan",
    thieves: "Outils de voleur",
    disguise: "Accessoires de déguisement",
    forgery: "Matériel de contrefaçon",
    herbalism: "Matériel d'herboriste",
    poisoner: "Matériel d'empoisonneur",
    navigator: "Instruments de navigateur",
    instrument: "Instrument de musique",
    gaming: "Boîte de jeux",
    other: "Outil",
  },
  en: {
    artisan: "Artisan's tools",
    thieves: "Thieves' tools",
    disguise: "Disguise kit",
    forgery: "Forgery kit",
    herbalism: "Herbalism kit",
    poisoner: "Poisoner's kit",
    navigator: "Navigator's tools",
    instrument: "Musical instrument",
    gaming: "Gaming set",
    other: "Tool",
  },
});

/** What the tool lets you do, in our own words (mechanics, not rulebook prose). */
export const TOOL_CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = localized({
  fr: {
    artisan:
      "Fabriquer, réparer et expertiser les objets liés au métier ; identifier certains matériaux ou ouvrages.",
    thieves: "Crocheter une serrure et désamorcer un piège mécanique.",
    disguise: "Vous grimer, ou grimer quelqu'un, pour changer d'apparence de façon convaincante.",
    forgery: "Contrefaire des documents et imiter une écriture, un sceau ou une signature.",
    herbalism: "Identifier des plantes, préparer des remèdes et fabriquer des potions de soins.",
    poisoner: "Préparer, doser et appliquer des poisons, et tenter d'en neutraliser.",
    navigator:
      "Tracer un cap, faire le point en mer et éviter de vous perdre en terrain découvert.",
    instrument: "Jouer de la musique ; sert aussi de focaliseur à certaines aptitudes de barde.",
    gaming: "Jouer, parier et tricher à ce jeu, et jauger l'honnêteté des autres joueurs.",
    other: "Voir la description de l'outil dans le livre de règles.",
  },
  en: {
    artisan:
      "Craft, repair and appraise items tied to the trade; identify certain materials or works.",
    thieves: "Pick a lock and disarm a mechanical trap.",
    disguise: "Make yourself, or someone else, up to change appearance convincingly.",
    forgery: "Forge documents and imitate handwriting, a seal or a signature.",
    herbalism: "Identify plants, prepare remedies and make potions of healing.",
    poisoner: "Prepare, dose and apply poisons, and try to neutralise them.",
    navigator: "Plot a course, take a fix at sea and avoid getting lost in open country.",
    instrument: "Play music; also serves as a focus for some bard features.",
    gaming: "Play, bet and cheat at this game, and gauge the other players' honesty.",
    other: "See the tool's description in the rulebook.",
  },
});

/** A catalogue entry (shape of every row in `tools.json`). */
export interface ToolDef {
  id: string;
  name: string;
  category: ToolCategory;
  /** Ability used for a check with this tool. */
  ability: Ability;
  /** Price in copper pieces (0 when the source lists it as "variable"). */
  priceCp: number;
  weightKg: number;
  /** What this specific tool is used for, in our own words (not rulebook prose). */
  description?: string;
}

/**
 * The subset of a {@link ToolDef} stored on a character's tool item. Carries
 * everything the rules engine needs so it never has to load the catalogue.
 */
export const toolPropsSchema = z.object({
  category: toolCategorySchema,
  ability: abilitySchema,
});
export type ToolProps = z.infer<typeof toolPropsSchema>;

export function toolPropsFromDef(def: ToolDef): ToolProps {
  return { category: def.category, ability: def.ability };
}

/**
 * Check modifier for a tool: ability modifier, plus the proficiency bonus once
 * (proficient) or twice (expertise).
 */
export function computeToolModifier(
  ability: Ability,
  mods: AbilityModifierBlock,
  proficiencyBonus: number,
  proficient: boolean,
  expert: boolean,
): number {
  return mods[ability] + (proficient ? proficiencyBonus * (expert ? 2 : 1) : 0);
}

/** Tool-choice groups a class or background can grant ("one of …"). */
export const TOOL_CHOICE_GROUPS = [
  "artisan",
  "instrument",
  "gaming",
  "artisan-or-instrument",
  "any",
] as const;
export type ToolChoiceGroup = (typeof TOOL_CHOICE_GROUPS)[number];

/** Whether a tool category can satisfy a given choice group. */
export function toolMatchesChoiceGroup(category: ToolCategory, group: ToolChoiceGroup): boolean {
  switch (group) {
    case "any":
      return true;
    case "artisan":
      return category === "artisan";
    case "instrument":
      return category === "instrument";
    case "gaming":
      return category === "gaming";
    case "artisan-or-instrument":
      return category === "artisan" || category === "instrument";
  }
}
