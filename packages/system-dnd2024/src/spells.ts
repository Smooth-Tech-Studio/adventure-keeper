import { z } from "zod";
import { abilitySchema } from "./abilities";
import type { ClassId } from "./classes";
import { dicePoolSchema, formatDicePool, type DicePool } from "./dice";
import { localized, pick } from "./locale";

/**
 * 5e 2024 spell **metadata** types and helpers. The spell *data* is not bundled
 * with the engine — it lives in the SRD pack's `srd/spells.json`, which the app
 * loads on demand (`SRD_CATALOGS`).
 * Only SRD 5.2.1 spells, cantrips through level 3.
 */
export const SPELL_SCHOOLS = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
] as const;
export const spellSchoolSchema = z.enum(SPELL_SCHOOLS);
export type SpellSchool = (typeof SPELL_SCHOOLS)[number];

export const SPELL_SCHOOL_LABELS: Record<SpellSchool, string> = localized({
  fr: {
    abjuration: "Abjuration",
    conjuration: "Invocation",
    divination: "Divination",
    enchantment: "Enchantement",
    evocation: "Évocation",
    illusion: "Illusion",
    necromancy: "Nécromancie",
    transmutation: "Transmutation",
  },
  en: {
    abjuration: "Abjuration",
    conjuration: "Conjuration",
    divination: "Divination",
    enchantment: "Enchantment",
    evocation: "Evocation",
    illusion: "Illusion",
    necromancy: "Necromancy",
    transmutation: "Transmutation",
  },
});

/**
 * What a school of magic is *for*, in one line. « Abjuration » and
 * « Évocation » are opaque until someone tells you; the card names the school
 * twice without ever saying what it means. Our words, never rulebook prose.
 */
export const SPELL_SCHOOL_SUMMARY: Record<SpellSchool, string> = localized({
  fr: {
    abjuration: "Protéger, bloquer, dissiper : les sorts qui tiennent le danger à distance.",
    conjuration: "Faire venir ou faire partir : créatures, objets, téléportations.",
    divination: "Savoir ce qu'on ignore : voir au loin, deviner, percer les mensonges.",
    enchantment: "Agir sur les esprits : charmer, apaiser, commander, endormir.",
    evocation: "Façonner l'énergie brute : feu, foudre, froid, et les soins les plus directs.",
    illusion: "Tromper les sens : images, sons, apparences qui n'existent pas vraiment.",
    necromancy: "Jouer sur la vie et la mort : drainer, affaiblir, relever les cadavres.",
    transmutation: "Changer ce qui est : la forme, la matière, la vitesse, les propriétés.",
  },
  en: {
    abjuration: "Protecting, blocking, dispelling: the spells that keep danger at bay.",
    conjuration: "Bringing things in or sending them away: creatures, objects, teleportation.",
    divination: "Learning what you don't know: seeing afar, foretelling, seeing through lies.",
    enchantment: "Working on minds: charming, calming, commanding, putting to sleep.",
    evocation: "Shaping raw energy: fire, lightning, cold, and the most direct healing.",
    illusion: "Fooling the senses: images, sounds, appearances that aren't really there.",
    necromancy: "Playing with life and death: draining, weakening, raising the dead.",
    transmutation: "Changing what is: shape, matter, speed, properties.",
  },
});

export interface SpellComponents {
  v: boolean;
  s: boolean;
  m: boolean;
}

/** Damage types (physical + elemental) plus `heal` for a healing spell. */
export const DAMAGE_KINDS = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
  "heal",
] as const;
export type DamageKind = (typeof DAMAGE_KINDS)[number];
export const damageKindSchema = z.enum(DAMAGE_KINDS);

export const DAMAGE_KIND_LABELS: Record<DamageKind, string> = localized({
  fr: {
    acid: "acide",
    bludgeoning: "contondant",
    cold: "froid",
    fire: "feu",
    force: "force",
    lightning: "foudre",
    necrotic: "nécrotique",
    piercing: "perforant",
    poison: "poison",
    psychic: "psychique",
    radiant: "radiant",
    slashing: "tranchant",
    thunder: "tonnerre",
    heal: "soin",
  },
  en: {
    acid: "acid",
    bludgeoning: "bludgeoning",
    cold: "cold",
    fire: "fire",
    force: "force",
    lightning: "lightning",
    necrotic: "necrotic",
    piercing: "piercing",
    poison: "poison",
    psychic: "psychic",
    radiant: "radiant",
    slashing: "slashing",
    thunder: "thunder",
    heal: "healing",
  },
});

/**
 * The dice a spell rolls, and how they grow. `à vérifier contre le PHB 2024` —
 * these are reference values, not authoritative rules text.
 */
export const spellDamageSchema = z.object({
  /** Dice at the base level. */
  pool: dicePoolSchema,
  kind: damageKindSchema,
  /**
   * `cantrip` = +`step` dice per tier (levels 5 / 11 / 17).
   * `slot` = +`step` dice per slot level above `slotLevel`.
   */
  scaling: z.enum(["cantrip", "slot"]).optional(),
  /** Dice added per scaling step (defaults to `pool`). */
  step: dicePoolSchema.optional(),
  /** Base slot level for a leveled spell (defaults to the spell's level). */
  slotLevel: z.number().int().optional(),
  /** Free note for the odd cases (multiple rays, split damage…). */
  note: z.string().optional(),
});
export type SpellDamage = z.infer<typeof spellDamageSchema>;

// --- Resolution: how the target resists the spell ----------------------

/**
 * What a **successful** saving throw does:
 * - `negates` — the spell has no effect on that target
 * - `half` — the target still takes half the (rolled) damage
 * - `partial` — a reduced or altered effect applies (details in `summary`)
 */
export const SPELL_SAVE_OUTCOMES = ["negates", "half", "partial"] as const;
export type SpellSaveOutcome = (typeof SPELL_SAVE_OUTCOMES)[number];
export const spellSaveOutcomeSchema = z.enum(SPELL_SAVE_OUTCOMES);

export const SPELL_SAVE_OUTCOME_LABELS: Record<SpellSaveOutcome, string> = localized({
  fr: {
    negates: "annulé si réussi",
    half: "½ dégâts si réussi",
    partial: "effet réduit si réussi",
  },
  en: {
    negates: "negated on a success",
    half: "half damage on a success",
    partial: "reduced effect on a success",
  },
});

/** A saving throw that deflects or lessens the spell. */
export const spellSaveSchema = z.object({
  ability: abilitySchema,
  onSuccess: spellSaveOutcomeSchema,
});
export type SpellSave = z.infer<typeof spellSaveSchema>;

/** `castingTime` uses short keys for the common cases, else a literal string. */
export type CastingTime = "action" | "bonus" | "reaction" | (string & {});

export interface SpellDef {
  id: string;
  name: string;
  /** 0 = cantrip (sort mineur). */
  level: number;
  school: SpellSchool;
  /** `ClassId`s, or `"pack:slug"` for a pack class. */
  classes: string[];
  castingTime: CastingTime;
  range: string;
  components: SpellComponents;
  /** Max duration, without the "Concentration," prefix. */
  duration: string;
  concentration: boolean;
  ritual: boolean;
  /**
   * One-sentence functional summary, written in our own words (mechanics, not
   * the rulebook's prose). The full description stays in the rulebook.
   */
  summary?: string;
  /** Damage / healing dice, when the spell rolls any. */
  damage?: SpellDamage;
  /**
   * Saving throw that deflects or lessens the spell, when it allows one. The
   * DC is the caster's spell save DC (`CharacterDerived.spellSaveDc`).
   */
  save?: SpellSave;
  /**
   * `true` when casting requires a spell attack roll against the target's AC
   * (bonus = `CharacterDerived.spellAttackBonus`). A few spells set both this
   * and `save` (a primary attack plus a secondary area save).
   */
  attackRoll?: boolean;
}

/**
 * The dice a spell rolls at a given character / slot level.
 * `characterLevel` drives cantrip scaling; `slotLevel` drives leveled-spell
 * scaling (defaults to the spell's own level).
 */
export function spellDamageAt(
  spell: Pick<SpellDef, "level" | "damage">,
  opts: { characterLevel?: number; slotLevel?: number },
): { pool: DicePool; kind: DamageKind } | null {
  const d = spell.damage;
  if (!d) return null;
  let count = d.pool.count;

  if (d.scaling === "cantrip") {
    // A cantrip adds its whole pool again at each tier (5 / 11 / 17).
    const step = d.step ?? d.pool;
    const lvl = opts.characterLevel ?? 1;
    const tiers = lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0;
    count += tiers * step.count;
  } else if (d.scaling === "slot") {
    // A leveled spell adds `step` (usually a single die) per slot level above base.
    const step = d.step ?? { count: 1, die: d.pool.die };
    const base = d.slotLevel ?? spell.level;
    const at = opts.slotLevel ?? base;
    count += Math.max(0, at - base) * step.count;
  }

  return { pool: { count, die: d.pool.die }, kind: d.kind };
}

/** Display strings for a spell's damage / healing on the spell card. */
export interface SpellDamageSummary {
  /** `"Dégâts"` or `"Soins"`. */
  label: string;
  /** The dice, e.g. `"8d6 feu"`, `"2d8"` (healing has no damage type). */
  dice: string;
  /** How the dice grow, in words, or `null` when the spell doesn't scale. */
  scaling: string | null;
  /** The spell's free-text damage note (`SpellDamage.note`), or `null`. */
  note: string | null;
}

/**
 * A spell's damage line for the card. When `characterLevel` is given, a cantrip's
 * `dice` is the total at that level; otherwise it's the base pool. `scaling`
 * always states the growth rule.
 */
export function spellDamageSummary(
  spell: Pick<SpellDef, "level" | "damage">,
  opts: { characterLevel?: number } = {},
): SpellDamageSummary | null {
  const d = spell.damage;
  if (!d) return null;

  const heal = d.kind === "heal";
  const scaled =
    d.scaling === "cantrip" && opts.characterLevel != null
      ? spellDamageAt(spell, { characterLevel: opts.characterLevel })
      : null;
  const pool = scaled?.pool ?? d.pool;
  const dice = heal
    ? formatDicePool(pool)
    : `${formatDicePool(pool)} ${DAMAGE_KIND_LABELS[d.kind]}`;

  let scaling: string | null = null;
  if (d.scaling === "cantrip") {
    scaling = pick({
      fr: `+${formatDicePool(d.step ?? d.pool)} aux niveaux 5, 11 et 17`,
      en: `+${formatDicePool(d.step ?? d.pool)} at levels 5, 11 and 17`,
    });
  } else if (d.scaling === "slot") {
    const step = d.step ?? { count: 1, die: d.pool.die };
    const base = d.slotLevel ?? spell.level;
    scaling = pick({
      fr: `+${formatDicePool(step)} par niveau d'emplacement au-delà du niveau ${base}`,
      en: `+${formatDicePool(step)} per slot level above ${base}`,
    });
  }

  return {
    label: heal ? pick({ fr: "Soins", en: "Healing" }) : pick({ fr: "Dégâts", en: "Damage" }),
    dice,
    scaling,
    note: d.note ?? null,
  };
}

export const spellIdSchema = z.string().min(1);

export const CASTING_TIME_LABELS: Record<string, string> = localized({
  fr: {
    action: "1 action",
    bonus: "1 action bonus",
    reaction: "1 réaction",
    "1 heure": "1 heure",
    "1 minute": "1 minute",
    "10 minutes": "10 minutes",
  },
  en: {
    action: "1 action",
    bonus: "1 bonus action",
    reaction: "1 reaction",
    "1 heure": "1 hour",
    "1 minute": "1 minute",
    "10 minutes": "10 minutes",
  },
});

export function castingTimeLabel(value: CastingTime): string {
  return CASTING_TIME_LABELS[value] ?? value;
}

/** Filter a spell list to a class, optionally by exact level or a max level. */
export function filterSpellsForClass(
  spells: SpellDef[],
  classId: string,
  options?: { level?: number; maxLevel?: number },
): SpellDef[] {
  return spells.filter((spell) => {
    if (!spell.classes.includes(classId as ClassId)) return false;
    if (options?.level !== undefined && spell.level !== options.level) return false;
    if (options?.maxLevel !== undefined && spell.level > options.maxLevel) return false;
    return true;
  });
}
