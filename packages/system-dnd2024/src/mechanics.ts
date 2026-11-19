/**
 * What a feature *does* to the sheet, described as data.
 *
 * A class feature, a subclass feature, a species trait, a feat or a class
 * option (Druid « Ordre primitif ») can carry a list of {@link Mechanic}s. The
 * engine folds them into the derived block — Armour Class, speed, initiative,
 * saving throws… — and the live session reads what is left (advantage on a
 * roll, a damage bonus, a critical range) when a roll is made.
 *
 * Like `ChoiceDef`, these are **plain, serialisable data**: a content pack
 * writes them as JSON (`packs/schema.ts` reuses {@link mechanicSchema}), and
 * the behaviour lives in {@link resolveMechanics}, never in the data.
 *
 * Anything the rules say that cannot be reduced to a number or a flag stays a
 * reminder (`note`): the sheet does not track positions, allies or durations.
 */

import { z } from "zod";
import { ABILITIES, abilitySchema, type Ability } from "./abilities";
import { armorCategorySchema, type ArmorCategory } from "./armors";
import { skillSchema, type Skill } from "./skills";
import { damageKindSchema, spellSchoolSchema, type DamageKind, type SpellSchool } from "./spells";

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

/**
 * A number the rules compute from the character: a constant, the proficiency
 * bonus (or half of it, rounded down), the level, an ability modifier (with a
 * floor), a multiple of the level (`{ perLevel: 5 }`), or a value that steps up
 * with the level (`[[2, 10], [6, 15]]` = 10 ft from level
 * 2, 15 ft from level 6).
 */
export type Amount =
  | number
  | "prof"
  | "halfProf"
  | "level"
  | { ability: Ability; min?: number }
  | { perLevel: number }
  | { byLevel: readonly (readonly [number, number])[] };

export const amountSchema: z.ZodType<Amount> = z.union([
  z.number().int().min(-20).max(100),
  z.enum(["prof", "halfProf", "level"]),
  z.object({ ability: abilitySchema, min: z.number().int().min(-5).max(10).optional() }),
  z.object({ perLevel: z.number().int().min(1).max(20) }),
  z.object({
    byLevel: z
      .array(z.tuple([z.number().int().min(1).max(20), z.number().int().min(-20).max(100)]))
      .min(1),
  }),
]);

/** What an {@link Amount} reads from. */
export interface AmountContext {
  level: number;
  proficiencyBonus: number;
  abilityModifiers: Record<Ability, number>;
}

export function resolveAmount(amount: Amount, ctx: AmountContext): number {
  if (typeof amount === "number") return amount;
  if (amount === "prof") return ctx.proficiencyBonus;
  if (amount === "halfProf") return Math.floor(ctx.proficiencyBonus / 2);
  if (amount === "level") return ctx.level;
  if ("ability" in amount)
    return Math.max(amount.min ?? -Infinity, ctx.abilityModifiers[amount.ability]);
  if ("perLevel" in amount) return amount.perLevel * ctx.level;
  let value = 0;
  for (const [from, step] of [...amount.byLevel].sort((a, b) => a[0] - b[0])) {
    if (ctx.level >= from) value = step;
  }
  return value;
}

/** How many uses a limited feature has (see `FeatureUses`), at least 1. */
export function limitedUsesMax(uses: { max: Amount }, ctx: AmountContext): number {
  return Math.max(1, resolveAmount(uses.max, ctx));
}

// ---------------------------------------------------------------------------
// Mechanics
// ---------------------------------------------------------------------------

/**
 * When an armour-dependent mechanic applies: without body armour (`unarmored`),
 * without body armour *nor* shield (`unarmoredNoShield`, the Monk), or without
 * heavy armour (`noHeavyArmor`, the Barbarian's Fast Movement).
 */
export const ARMOR_CONDITIONS = ["unarmored", "unarmoredNoShield", "noHeavyArmor"] as const;
export const armorConditionSchema = z.enum(ARMOR_CONDITIONS);
export type ArmorCondition = (typeof ARMOR_CONDITIONS)[number];

/** What a damage bonus applies to. */
export const DAMAGE_TARGETS = ["cantrip", "spell", "weapon", "unarmed"] as const;
export const damageTargetSchema = z.enum(DAMAGE_TARGETS);
export type DamageTarget = (typeof DAMAGE_TARGETS)[number];

/** The d20 rolls an advantage can bear on. */
export const D20_ROLLS = ["save", "check", "attack", "initiative", "deathSave"] as const;
export const d20RollSchema = z.enum(D20_ROLLS);
export type D20Roll = (typeof D20_ROLLS)[number];

const levelGate = { minLevel: z.number().int().min(1).max(20).optional() };
const text = z.string().trim().min(1).max(300);

/**
 * One thing a feature changes. Every variant may carry `minLevel` (character
 * level for a species trait or a feat, class level for a class or subclass
 * feature) when it starts later than the feature itself.
 */
export const mechanicSchema = z.discriminatedUnion("type", [
  /** Base AC = 10 + Dex + `ability` without body armour (Barbare, Moine, Draconique). */
  z.object({
    type: z.literal("unarmoredDefense"),
    ability: abilitySchema,
    /** `false`: lost with a shield too (the Monk). */
    shield: z.boolean(),
    ...levelGate,
  }),
  /** Walking speed, in feet (Déplacement sans armure, Déplacement rapide). */
  z.object({
    type: z.literal("speed"),
    bonus: amountSchema,
    when: armorConditionSchema.optional(),
    ...levelGate,
  }),
  /** Another way of moving, at the walking speed or a fixed number of feet. */
  z.object({
    type: z.literal("movement"),
    mode: z.enum(["climb", "swim", "fly"]),
    /** Feet; absent = equal to the walking speed. */
    feet: z.number().int().min(5).max(300).optional(),
    when: armorConditionSchema.optional(),
    ...levelGate,
  }),
  /** Initiative: a bonus (Vigilant: the proficiency bonus) and / or advantage. */
  z.object({
    type: z.literal("initiative"),
    bonus: amountSchema.optional(),
    advantage: z.boolean().optional(),
    ...levelGate,
  }),
  /** Proficiency in saving throws (Esprit fuyant: Sagesse, Charisme). */
  z.object({
    type: z.literal("saveProficiency"),
    abilities: z.union([z.array(abilitySchema).min(1), z.literal("all")]),
    ...levelGate,
  }),
  /** A bonus to saving throws (Aura de protection: the Charisma modifier, minimum 1). */
  z.object({
    type: z.literal("saveBonus"),
    bonus: amountSchema,
    abilities: z.union([z.array(abilitySchema).min(1), z.literal("all")]).optional(),
    ...levelGate,
  }),
  /**
   * A bonus to ability checks: on some skills (Magicien primitif: Sagesse en
   * Arcanes et Nature), or on every check the character is *not* proficient in
   * (Touche-à-tout: half the proficiency bonus, initiative included).
   */
  z.object({
    type: z.literal("checkBonus"),
    bonus: amountSchema,
    skills: z.array(skillSchema).min(1).optional(),
    unproficientOnly: z.boolean().optional(),
    ...levelGate,
  }),
  /**
   * Advantage on a kind of d20 roll. Without `condition` the roll sheet ticks
   * it by itself; with one (« contre l'état Charmé ») it only reminds.
   */
  z.object({
    type: z.literal("advantage"),
    on: d20RollSchema,
    abilities: z.array(abilitySchema).min(1).optional(),
    skills: z.array(skillSchema).min(1).optional(),
    condition: text.optional(),
    ...levelGate,
  }),
  /** Armour categories the character is trained with (Gardien: intermédiaire). */
  z.object({
    type: z.literal("armorTraining"),
    categories: z.array(armorCategorySchema).min(1),
    ...levelGate,
  }),
  /** Proficiency with martial weapons (Gardien, Protecteur). */
  z.object({ type: z.literal("martialWeapons"), ...levelGate }),
  /** Max hit points per character level (Résistance draconique). */
  z.object({
    type: z.literal("hitPointsPerLevel"),
    value: z.number().int().min(1).max(5),
    ...levelGate,
  }),
  /** Ability scores raised beyond 20 (Champion primitif: Force, Constitution +4, max 25). */
  z.object({
    type: z.literal("abilityScore"),
    abilities: z.array(abilitySchema).min(1),
    bonus: z.number().int().min(1).max(10),
    max: z.number().int().min(10).max(30),
    ...levelGate,
  }),
  /** Damage types resisted. */
  z.object({
    type: z.literal("resistance"),
    damage: z.array(damageKindSchema).min(1),
    ...levelGate,
  }),
  /** A special sense, in feet (Sens sauvages: vision aveugle 9 m). */
  z.object({
    type: z.literal("sense"),
    sense: z.enum(["darkvision", "blindsight", "truesight", "tremorsense"]),
    feet: z.number().int().min(5).max(300),
    ...levelGate,
  }),
  /** Cantrips known on top of the class table (Magicien primitif, Thaumaturge). */
  z.object({
    type: z.literal("extraCantrips"),
    count: z.number().int().min(1).max(5),
    ...levelGate,
  }),
  /** Critical hits on a lower d20 (Champion: 19, then 18). */
  z.object({
    type: z.literal("critRange"),
    min: z.number().int().min(15).max(19),
    ...levelGate,
  }),
  /**
   * A flat bonus to damage (Incantation puissante: Sagesse aux sorts mineurs ;
   * Évocation améliorée: Intelligence aux sorts d'évocation).
   */
  z.object({
    type: z.literal("damageBonus"),
    bonus: amountSchema,
    on: damageTargetSchema,
    school: spellSchoolSchema.optional(),
    ...levelGate,
  }),
  /** A reminder for the combat block, for what the sheet cannot compute. */
  z.object({ type: z.literal("note"), text, ...levelGate }),
]);
export type Mechanic = z.infer<typeof mechanicSchema>;

/** A mechanic and the feature it comes from, for labels on the sheet and the roll. */
export interface SourcedMechanic {
  mechanic: Mechanic;
  /** « Vigilant », « Déplacement sans armure »… */
  source: string;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** The worn equipment the armour conditions are judged on. */
export interface ArmorState {
  /** Body armour worn (shields aside). */
  bodyArmor: { category: ArmorCategory } | null;
  shield: boolean;
}

export function armorConditionMet(when: ArmorCondition | undefined, armor: ArmorState): boolean {
  switch (when) {
    case undefined:
      return true;
    case "unarmored":
      return armor.bodyArmor === null;
    case "unarmoredNoShield":
      return armor.bodyArmor === null && !armor.shield;
    case "noHeavyArmor":
      return armor.bodyArmor?.category !== "heavy";
  }
}

/** An advantage the roll sheet knows about. */
export interface ResolvedAdvantage {
  on: D20Roll;
  abilities?: Ability[];
  skills?: Skill[];
  /** Only a reminder when present. */
  condition?: string;
  source: string;
}

/** A damage bonus the roll sheet adds, already computed. */
export interface ResolvedDamageBonus {
  on: DamageTarget;
  school?: SpellSchool;
  flat: number;
  source: string;
}

/** Everything the mechanics add up to, before the engine folds it in. */
export interface ResolvedMechanics {
  /** Best unarmoured AC ability, if any (the highest total wins). */
  unarmoredDefense: { ability: Ability; shield: boolean; source: string }[];
  speedBonus: number;
  movement: { climb: number | "speed"; swim: number | "speed"; fly: number | "speed" };
  initiativeBonus: number;
  /** What makes up `initiativeBonus` (and Touche-à-tout), for the sheet's trace. */
  initiativeSources: { source: string; bonus: number }[];
  initiativeAdvantage: boolean;
  saveProficiencies: Ability[];
  saveBonus: Record<Ability, number>;
  /** Flat bonus per skill. */
  skillBonus: Partial<Record<Skill, number>>;
  /** Added to every check the character is not proficient in (initiative too). */
  unproficientCheckBonus: number;
  advantages: ResolvedAdvantage[];
  armorTraining: ArmorCategory[];
  martialWeapons: boolean;
  hitPointsPerLevel: number;
  /** What makes up `hitPointsPerLevel`, for the sheet's trace. */
  hitPointSources: { source: string; perLevel: number }[];
  abilityScores: { ability: Ability; bonus: number; max: number }[];
  resistances: DamageKind[];
  senses: Partial<Record<"darkvision" | "blindsight" | "truesight" | "tremorsense", number>>;
  extraCantrips: number;
  /** Lowest natural d20 that is a critical hit (20 by default). */
  critRange: number;
  damageBonuses: ResolvedDamageBonus[];
  notes: string[];
}

/** No mechanic at all: what a sheet without any resolves to. */
export function emptyMechanics(): ResolvedMechanics {
  return {
    unarmoredDefense: [],
    speedBonus: 0,
    movement: { climb: 0, swim: 0, fly: 0 },
    initiativeBonus: 0,
    initiativeSources: [],
    initiativeAdvantage: false,
    saveProficiencies: [],
    saveBonus: Object.fromEntries(ABILITIES.map((a) => [a, 0])) as Record<Ability, number>,
    skillBonus: {},
    unproficientCheckBonus: 0,
    advantages: [],
    armorTraining: [],
    martialWeapons: false,
    hitPointsPerLevel: 0,
    hitPointSources: [],
    abilityScores: [],
    resistances: [],
    senses: {},
    extraCantrips: 0,
    critRange: 20,
    damageBonuses: [],
    notes: [],
  };
}

/**
 * Fold a list of mechanics into one summary. Mechanics whose `minLevel` is not
 * reached, or whose armour condition is not met, are left out. Pure.
 *
 * `ctx.abilityModifiers` are the modifiers *before* any `abilityScore`
 * mechanic: the engine raises the scores first, then resolves the rest again
 * with the new modifiers (see `deriveCharacter`).
 */
export function resolveMechanics(
  list: readonly SourcedMechanic[],
  ctx: AmountContext & { armor: ArmorState },
): ResolvedMechanics {
  const out = emptyMechanics();
  const amount = (value: Amount) => resolveAmount(value, ctx);
  const better = (current: number | "speed", next: number | "speed"): number | "speed" =>
    current === "speed" || next === "speed" ? "speed" : Math.max(current, next);

  for (const { mechanic: m, source } of list) {
    if (m.minLevel !== undefined && ctx.level < m.minLevel) continue;
    switch (m.type) {
      case "unarmoredDefense":
        out.unarmoredDefense.push({ ability: m.ability, shield: m.shield, source });
        break;
      case "speed":
        if (armorConditionMet(m.when, ctx.armor)) out.speedBonus += amount(m.bonus);
        break;
      case "movement":
        if (armorConditionMet(m.when, ctx.armor))
          out.movement[m.mode] = better(out.movement[m.mode], m.feet ?? "speed");
        break;
      case "initiative":
        if (m.bonus !== undefined) {
          const bonus = amount(m.bonus);
          out.initiativeBonus += bonus;
          out.initiativeSources.push({ source, bonus });
        }
        if (m.advantage) {
          out.initiativeAdvantage = true;
          out.advantages.push({ on: "initiative", source });
        }
        break;
      case "saveProficiency":
        for (const ability of m.abilities === "all" ? ABILITIES : m.abilities)
          if (!out.saveProficiencies.includes(ability)) out.saveProficiencies.push(ability);
        break;
      case "saveBonus":
        for (const ability of m.abilities === undefined || m.abilities === "all"
          ? ABILITIES
          : m.abilities)
          out.saveBonus[ability] += amount(m.bonus);
        break;
      case "checkBonus":
        if (m.unproficientOnly) {
          const bonus = amount(m.bonus);
          out.unproficientCheckBonus += bonus;
          out.initiativeSources.push({ source, bonus });
        }
        for (const skill of m.skills ?? [])
          out.skillBonus[skill] = (out.skillBonus[skill] ?? 0) + amount(m.bonus);
        break;
      case "advantage":
        out.advantages.push({
          on: m.on,
          ...(m.abilities ? { abilities: m.abilities } : {}),
          ...(m.skills ? { skills: m.skills } : {}),
          ...(m.condition ? { condition: m.condition } : {}),
          source,
        });
        if (m.on === "initiative" && !m.condition) out.initiativeAdvantage = true;
        break;
      case "armorTraining":
        for (const category of m.categories)
          if (!out.armorTraining.includes(category)) out.armorTraining.push(category);
        break;
      case "martialWeapons":
        out.martialWeapons = true;
        break;
      case "hitPointsPerLevel":
        out.hitPointsPerLevel += m.value;
        out.hitPointSources.push({ source, perLevel: m.value });
        break;
      case "abilityScore":
        for (const ability of m.abilities)
          out.abilityScores.push({ ability, bonus: m.bonus, max: m.max });
        break;
      case "resistance":
        for (const kind of m.damage)
          if (!out.resistances.includes(kind)) out.resistances.push(kind);
        break;
      case "sense":
        out.senses[m.sense] = Math.max(out.senses[m.sense] ?? 0, m.feet);
        break;
      case "extraCantrips":
        out.extraCantrips += m.count;
        break;
      case "critRange":
        out.critRange = Math.min(out.critRange, m.min);
        break;
      case "damageBonus":
        out.damageBonuses.push({
          on: m.on,
          ...(m.school ? { school: m.school } : {}),
          flat: amount(m.bonus),
          source,
        });
        break;
      case "note":
        out.notes.push(`${source} : ${m.text}`);
        break;
    }
  }
  return out;
}

/**
 * The best Armour Class without body armour: 10 + Dex + the best ability the
 * mechanics allow (a shield rules out the Monk's), or `null` when none applies.
 */
export function unarmoredDefenseBase(
  options: ResolvedMechanics["unarmoredDefense"],
  abilityModifiers: Record<Ability, number>,
  shield: boolean,
): number | null {
  const usable = options.filter((o) => o.shield || !shield);
  if (usable.length === 0) return null;
  return 10 + Math.max(...usable.map((o) => abilityModifiers[o.ability]));
}
