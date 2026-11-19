/**
 * 5e 2024 feats (« dons »).
 *
 * Four categories in the 2024 rules: origin feats (granted at level 1 by the
 * background), fighting-style feats (Fighter 1, Paladin 2, Ranger 2), general
 * feats (from level 4, in place of an ability-score improvement) and epic boons
 * (level 19). All four are listed; general feats and epic boons carry names,
 * prerequisites, summaries and their +1 to an ability ({@link FeatDef.abilityIncrease})
 * — no other `effects` or inner `choices` yet.
 *
 * **Only the SRD 5.2.1 content lives here.** Everything else from the 2024
 * rules was moved out of the code on 8 October 2026 into a private content pack
 * (see `docs/CONTENT_PACKS.md`): a table that owns the book imports it and
 * shares it, the app does not ship it.
 *
 * Note « Amélioration de caractéristique » is itself a general feat in 2024:
 * raising your scores and taking a feat are the same slot, which is why the
 * level choice in `resolve-choices.ts` is a plain feat pick.
 *
 * Names and effects follow https://www.aidedd.org/regles-24/ and the per-feat
 * pages at `https://www.aidedd.org/feat/fr/<slug>`. Every `summary` is a short
 * reminder **in our own words** — a memory jogger, not rules text.
 *
 * Like `choices.ts`, this file is plain serialisable data: the `FeatDef` list
 * holds no functions, and behaviour lives in the pure helpers at the bottom.
 */

import { z } from "zod";
import type { Mechanic } from "./mechanics";
import { ABILITIES, type Ability } from "./abilities";
import { choiceValue, type ChoiceDef, type ChoicePick } from "./choices";
import type { ArmorCategory } from "./armors";
import type { DicePool } from "./dice";
import { getClass } from "./classes";
import { activeContent } from "./packs/active";
import { localized, pick, translateTree, type Shadow } from "./locale";
import SRD_FEATS from "./srd/feats.json";

export const FEAT_CATEGORIES = ["origin", "fightingStyle", "general", "epic"] as const;
export const featCategorySchema = z.enum(FEAT_CATEGORIES);
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

export const FEAT_CATEGORY_LABELS: Record<FeatCategory, string> = localized({
  fr: {
    origin: "Don d'origine",
    fightingStyle: "Style de combat",
    general: "Don général",
    epic: "Don épique",
  },
  en: {
    origin: "Origin feat",
    fightingStyle: "Fighting style",
    general: "General feat",
    epic: "Epic boon",
  },
});

/**
 * The part of a feat the rules engine can fold into a number. Everything else is
 * a reminder on the sheet — same split as `InvocationDef`.
 */
export interface FeatEffects {
  /** Max hit points gained per character level (Robuste: 2). */
  hitPointsPerLevel?: number;
  /** Flat bonus to attack rolls with ranged weapons (Archerie: 2). */
  rangedAttackBonus?: number;
  /** Flat damage bonus with a single one-handed melee weapon (Duel: 2). */
  duelingDamageBonus?: number;
  /** Flat damage bonus on a ranged attack with a Thrown weapon (Armes de lancer: 2). */
  thrownDamageBonus?: number;
  /** AC bonus while wearing armour (Défense: 1). */
  armoredAcBonus?: number;
  /** Armour categories the feat trains the character in, on top of the class's. */
  armorTraining?: ArmorCategory[];
  /**
   * Replaces the Unarmed Strike's damage die (Bagarreur de tavernes: 1d4
   * instead of a flat 1).
   */
  unarmedDamageDice?: DicePool;
  /**
   * Adds the proficiency bonus to damage with a Heavy weapon, once per turn
   * (Maître des armes lourdes). Folded into the attack line, since the sheet
   * cannot track "once per turn" anyway.
   */
  heavyWeaponProficiencyDamage?: boolean;
}

/**
 * The +1 most general feats and every epic boon give to an ability. A single
 * option is applied as is; several open a pick ({@link featAbilityChoiceId}).
 */
export interface FeatAbilityIncrease {
  /** The abilities the +1 may go to; `"any"` for all six. */
  options: readonly Ability[] | "any";
  /** Highest score it can reach. Default: 30 for an epic boon, 20 otherwise. */
  max?: number;
}

export interface FeatDef {
  id: string;
  name: string;
  category: FeatCategory;
  /**
   * Why you would take this feat, in a handful of words — what it turns you
   * into, not what it costs in rules. Shown as the line you scan in the
   * picker, where general feats all opening on « +1 en Force » are
   * unreadable. The {@link summary} stays, on the sheet.
   *
   * Origin feats and fighting styles have none: their summary is already short
   * and *is* the thing you choose on.
   */
  blurb?: string;
  /** Short reminder, our words. */
  summary: string;
  /** May be taken more than once. */
  repeatable?: boolean;
  /** Character level required: 4 for a general feat, 19 for an epic boon. */
  minLevel?: number;
  /**
   * The rest of the prerequisite (an ability score, a training, a spellcasting
   * feature) — shown as a hint, **not enforced**: the 2024 conditions read on
   * things the sheet does not always model.
   */
  prerequisite?: string;
  /** Picks the feat itself requires, opened once the feat is chosen. */
  choices?: ChoiceDef[];
  /** +1 to an ability, on top of what the feat does. */
  abilityIncrease?: FeatAbilityIncrease;
  effects?: FeatEffects;
  /** What the feat changes beyond `effects`, in the shared format (see `mechanics.ts`). */
  mechanics?: Mechanic[];
  /** A reminder for the sheet's combat block (see {@link featCombatNotes}). */
  combatNote?: string;
  /** A bonus action the feat adds, listed with the class's own (see {@link featBonusActions}). */
  bonusAction?: string;
}

/**
 * The name of a spell-catalogue family: every spell of `classId` at `level`.
 * The members are not listed here — spells live in the web app's JSON, so the
 * pool names the family and `ChoiceContext.catalogGroups` resolves it, exactly
 * as the tool families do.
 */
export function spellGroup(classId: string, level: number): string {
  return `${classId}:${level}`;
}

/** Reads a group name back — `"cleric:0"` → `{ classId: "cleric", level: 0 }`. */
export function parseSpellGroup(group: string): { classId: string; level: number } | undefined {
  const [classId, level] = group.split(":");
  const parsed = Number(level);
  if (!classId || !Number.isInteger(parsed)) return undefined;
  return { classId, level: parsed };
}

/**
 * The SRD feats, read from `srd/feats.json` (the pack format). A feat's own
 * picks are `feat:<id>:<slug>`, as for a pack feat.
 */
export const FEATS: FeatDef[] = (SRD_FEATS.entries as unknown as FeatDef[]).map((feat) => ({
  ...feat,
  ...(feat.choices && {
    choices: feat.choices.map((choice) => ({
      ...choice,
      id: `feat:${feat.id}:${choice.id}`,
      source: "feat" as const,
    })),
  }),
}));

{
  const english = SRD_FEATS.translations.en as Record<string, Shadow>;
  FEATS.forEach((feat) => translateTree(feat, { en: english[feat.id] }));
}

// ===========================================================================
// Lookups & aggregation
// ===========================================================================

const BY_ID = new Map(FEATS.map((feat) => [feat.id, feat]));

export function getFeat(id: string): FeatDef | undefined {
  return activeContent()?.feats.get(id) ?? BY_ID.get(id);
}

/** Every feat of a category, in catalogue order — SRD first, then active packs. */
export function featsOfCategory(category: FeatCategory): FeatDef[] {
  const packs = activeContent()?.feats;
  const all = packs ? [...FEATS, ...packs.values()] : FEATS;
  return all.filter((feat) => feat.category === category);
}

/**
 * Feats of a category the character is high enough level to take. The rest of
 * the prerequisite (an ability score, a training) is shown but not enforced.
 */
export function featsAvailableAt(category: FeatCategory, level: number): FeatDef[] {
  return featsOfCategory(category).filter((feat) => level >= (feat.minLevel ?? 1));
}

/** The pick behind a feat's +1 when it may go to more than one ability. */
export function featAbilityChoiceId(featId: string): string {
  return `feat:${featId}:ability-increase`;
}

function abilityIncreaseChoice(feat: FeatDef): ChoiceDef | undefined {
  const options = feat.abilityIncrease?.options;
  if (!options || (options !== "any" && options.length < 2)) return undefined;
  return {
    id: featAbilityChoiceId(feat.id),
    source: "feat",
    kind: "ability",
    label: pick({
      fr: `${feat.name} — +1 en caractéristique`,
      en: `${feat.name} — +1 to an ability`,
    }),
    count: 1,
    pool: options === "any" ? { kind: "any" } : { kind: "list", values: options },
    hint: pick({
      fr: `Sans dépasser ${featAbilityMax(feat)}.`,
      en: `Up to ${featAbilityMax(feat)}.`,
    }),
  };
}

function featAbilityMax(feat: FeatDef): number {
  return feat.abilityIncrease?.max ?? (feat.category === "epic" ? 30 : 20);
}

/** The choices a set of chosen feats opens — folded into the global choice list. */
export function featChoices(featIds: readonly string[]): ChoiceDef[] {
  return featIds.flatMap((id) => {
    const feat = getFeat(id);
    if (!feat) return [];
    const increase = abilityIncreaseChoice(feat);
    return increase ? [...(feat.choices ?? []), increase] : (feat.choices ?? []);
  });
}

/**
 * The +1s the held feats give, each with the score it may not exceed. A feat
 * whose ability is still unpicked gives nothing yet.
 */
export function featAbilityIncreases(
  featIds: readonly string[],
  picks: readonly ChoicePick[] | undefined,
): { ability: Ability; max: number }[] {
  return featIds.flatMap((id) => {
    const feat = getFeat(id);
    const options = feat?.abilityIncrease?.options;
    if (!feat || !options) return [];
    const ability =
      options !== "any" && options.length === 1
        ? options[0]
        : (choiceValue(picks, featAbilityChoiceId(feat.id)) as Ability | undefined);
    const allowed = options === "any" ? ABILITIES : options;
    if (!ability || !allowed.includes(ability)) return [];
    return [{ ability, max: featAbilityMax(feat) }];
  });
}

/** The level at which the class gets a fighting style, if it does. */
export function fightingStyleLevel(classId: string): number | undefined {
  return getClass(classId)?.fightingStyleLevel;
}

/** `true` when the class has reached its fighting-style level. */
export function hasFightingStyle(classId: string, level: number): boolean {
  const at = fightingStyleLevel(classId);
  return at !== undefined && level >= at;
}

/** The numeric effects of a set of feats, summed. */
export interface ResolvedFeatEffects extends Required<Omit<FeatEffects, "unarmedDamageDice">> {
  /** `null` when no feat improves the Unarmed Strike. */
  unarmedDamageDice: DicePool | null;
}

export function featEffects(featIds: readonly string[]): ResolvedFeatEffects {
  const defs = featIds.map(getFeat).filter((def): def is FeatDef => Boolean(def));
  const sum = (pick: (effects: FeatEffects) => number | undefined) =>
    defs.reduce((total, def) => total + (pick(def.effects ?? {}) ?? 0), 0);

  return {
    hitPointsPerLevel: sum((e) => e.hitPointsPerLevel),
    rangedAttackBonus: sum((e) => e.rangedAttackBonus),
    duelingDamageBonus: sum((e) => e.duelingDamageBonus),
    thrownDamageBonus: sum((e) => e.thrownDamageBonus),
    armoredAcBonus: sum((e) => e.armoredAcBonus),
    armorTraining: [...new Set(defs.flatMap((def) => def.effects?.armorTraining ?? []))],
    // The best die wins if two feats ever improved the same strike.
    unarmedDamageDice:
      defs.reduce<DicePool | null>((best, def) => def.effects?.unarmedDamageDice ?? best, null) ??
      null,
    heavyWeaponProficiencyDamage: defs.some((def) => def.effects?.heavyWeaponProficiencyDamage),
  };
}

/** Bonus-action options a feat unlocks, for the sheet's combat block. */
export function featBonusActions(featIds: readonly string[]): string[] {
  return featIds.flatMap((id) => getFeat(id)?.bonusAction ?? []);
}

/**
 * Reminders for the feats whose effect cannot be folded into a number. What
 * the sheet already counts (Vigilant, Archerie…) is not a reminder: the derived
 * block lists it as `includedEffects`, beside the number it changes.
 */
export function featCombatNotes(featIds: readonly string[]): string[] {
  return featIds.flatMap((id) => getFeat(id)?.combatNote ?? []);
}
