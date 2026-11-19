import { z } from "zod";
import {
  abilityBonusBlockSchema,
  abilityModifierBlockSchema,
  abilitySchema,
  abilityScoreBlockSchema,
  alignmentSchema,
  backgroundIdSchema,
  contentPackSchema,
  choicePickSchema,
  classIdSchema,
  creatureSizeSchema,
  d20RollSchema,
  damageKindSchema,
  damageTargetSchema,
  damageTypeSchema,
  grantedSpellSchema,
  invocationPickInputSchema,
  languageIdSchema,
  monsterIdSchema,
  packEntryIdSchema,
  skillModifierBlockSchema,
  skillSchema,
  speciesIdSchema,
  speciesSpellAbilitySchema,
  spellSchoolSchema,
  spellIdSchema,
  weaponMasterySchema,
} from "@adventure-keeper/system-dnd2024";
import { auditFieldsSchema } from "./common";
import { itemSchema } from "./item";
import { companionSchema } from "./companion";

/**
 * Coin purse: platinum / gold / electrum / silver / copper pieces (pièces de
 * platine / d'or / d'électrum / d'argent / de cuivre). `platinum` and `electrum`
 * are absent on sheets saved before they existed — they default to 0.
 */
export const moneySchema = z.object({
  platinum: z.number().int().min(0).default(0),
  gold: z.number().int().min(0).default(0),
  electrum: z.number().int().min(0).default(0),
  silver: z.number().int().min(0).default(0),
  copper: z.number().int().min(0).default(0),
});
export type Money = z.infer<typeof moneySchema>;

export const ZERO_MONEY: Money = { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };

/**
 * A square region of the character image reused as its icon, expressed as
 * fractions (0–1) of the image's natural width / height.
 */
export const imageCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.01).max(1),
  h: z.number().min(0.01).max(1),
});
export type ImageCrop = z.infer<typeof imageCropSchema>;

/** `#rrggbb`. */
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Where a sheet is in its life:
 *
 * - `ready` — passed the creation rules and carries every field the session
 *   engine reads (hit points, AC, modifiers…). The only kind that can be picked
 *   for a campaign or brought into a session.
 * - `draft` — saved half-filled so a player can stop and come back. Almost
 *   nothing is guaranteed, and the derived block cannot be computed at all
 *   (it needs a class and the six ability scores).
 */
export const CHARACTER_STATUSES = ["draft", "ready"] as const;
export const characterStatusSchema = z.enum(CHARACTER_STATUSES);
export type CharacterStatus = (typeof CHARACTER_STATUSES)[number];

/** Applied to legacy docs written before the field existed. */
export const DEFAULT_CHARACTER_STATUS: CharacterStatus = "ready";

/** A 5e character's personality, each line free text. */
export const characterPersonalitySchema = z.object({
  traits: z.string().max(1000).optional(),
  ideals: z.string().max(1000).optional(),
  bonds: z.string().max(1000).optional(),
  flaws: z.string().max(1000).optional(),
});
export type CharacterPersonality = z.infer<typeof characterPersonalitySchema>;

/** Fields every character has, whatever its rules system. */
const characterCommonFields = {
  name: z.string().min(1).max(120),
  /** Accent colour (`#rrggbb`). */
  color: hexColorSchema.optional(),
  /** URL of an externally-hosted character image. */
  imageUrl: z.string().url().optional(),
  /** Region of the image reused as the character icon. */
  imageCrop: imageCropSchema.optional(),
};

/**
 * Fields of a stored, finished sheet beyond what its player fills in.
 *
 * `campaignIds`: the campaigns the character was brought into (kept by its
 * owner, who writes the campaign roster). Their GM and members may read the
 * sheet — `firestore.rules` checks the first ten.
 */
const characterStoredFields = {
  status: z.literal("ready").default("ready"),
  ownerId: z.string().min(1),
  campaignIds: z.array(z.string().min(1)).max(200).optional(),
};

// ===========================================================================
// "standard" — system-agnostic sheet
// ===========================================================================

export const standardCharacterInputSchema = z.object({
  system: z.literal("standard"),
  ...characterCommonFields,
  /** Entered by the player (no class / CON to compute it). */
  maxHitPoints: z.number().int().min(1).max(100000).default(1),
  inventory: z.array(itemSchema).max(300).default([]),
  /** Free notes on the sheet. */
  notes: z.string().max(5000).optional(),
});
export type StandardCharacterInput = z.infer<typeof standardCharacterInputSchema>;

export const standardCharacterSchema = auditFieldsSchema
  .merge(standardCharacterInputSchema)
  .extend(characterStoredFields);
export type StandardCharacter = z.infer<typeof standardCharacterSchema>;

// ===========================================================================
// "dnd2024" — 5e 2024 sheet, mechanics computed from the input
// ===========================================================================

/**
 * Player-entered fields of a 5e 2024 character. The derived block
 * (`dnd2024DerivedSchema`) is computed from these via `computeCharacterDerived`.
 */
export const dnd2024CharacterInputSchema = z.object({
  system: z.literal("dnd2024"),
  ...characterCommonFields,
  /** An SRD species, or `"pack:slug"` for a content-pack species. */
  speciesId: z.union([speciesIdSchema, packEntryIdSchema]),
  /** Lineage / ancestry / legacy choice within the species, if any. */
  speciesChoice: z.string().max(60).optional(),
  /**
   * Size, for a species that lets the player pick (Aasimar, Humain, Tieffelin:
   * Small or Medium). Left out otherwise — the species fixes it — and Medium is
   * assumed when a choosing species has none.
   */
  size: creatureSizeSchema.optional(),
  /**
   * Ability the species-granted spells are cast with (Elf lineage, Tiefling
   * legacy): Intelligence, Wisdom or Charisma, the player's pick. Falls back to
   * the class's casting ability, else Charisma.
   */
  speciesSpellAbility: speciesSpellAbilitySchema.optional(),
  /** An SRD class, or `"pack:slug"` for a content-pack class (lot 3 of `docs/RULES_AND_CONTENT.md`). */
  classId: z.union([classIdSchema, packEntryIdSchema]),
  /** An SRD background, or `"pack:slug"` for a content-pack background. */
  backgroundId: z.union([backgroundIdSchema, packEntryIdSchema]),
  alignment: alignmentSchema,
  /** Player-written background story — the prologue of the story chapters. */
  lore: z.string().max(5000).optional(),
  /** Personality traits, ideals, bonds and flaws, in the player's words. */
  personality: characterPersonalitySchema.optional(),
  level: z.number().int().min(1).max(20).default(1),
  /**
   * The content-pack entries this sheet uses (species, background, subclass,
   * feats, spells), copied when the character is saved — only those, in the
   * pack format (see `extractUsedContent`). The sheet derives from this copy,
   * so editing, deleting or un-sharing the pack never changes it.
   */
  packContent: z.array(contentPackSchema).max(20).default([]),
  /**
   * Accumulated experience points. Optional (legacy sheets have none); the
   * suggested level is derived via `levelForXp`, but `level` stays
   * authoritative — a level-up is always applied explicitly.
   */
  experiencePoints: z.number().int().min(0).optional(),
  /**
   * Languages chosen by the player. Grants from base / species / class are
   * computed (`grantedLanguages`), not stored here.
   */
  languages: z
    .array(z.union([languageIdSchema, packEntryIdSchema]))
    .max(30)
    .default([]),
  /** Chosen cantrips (spell ids, level 0). */
  cantrips: z.array(spellIdSchema).max(30).default([]),
  /** Chosen leveled spells (spell ids, level >= 1). */
  spells: z.array(spellIdSchema).max(150).default([]),
  /**
   * Warlock « Manifestations occultes » chosen: `{ id, spellId? }` — `spellId` is
   * the cantrip a Décharge déchirante / répulsive / Lance occulte is attached to.
   */
  eldritchInvocations: z.array(invocationPickInputSchema).max(12).default([]),
  /** Item id of the pact weapon (Pacte de la lame): attacks with Charisma. */
  pactWeaponId: z.string().optional(),
  /**
   * Skill proficiencies the player picked from the class list. The background's
   * two skills are granted automatically and are **not** stored here.
   */
  skillProficiencies: z.array(skillSchema).max(18).default([]),
  /**
   * Skill proficiencies chosen from a species trait (Elf "Sens aiguisés",
   * Human "Compétent"). Kept separate from the class picks above.
   */
  speciesSkillProficiencies: z.array(skillSchema).max(4).default([]),
  /** Skills the character has expertise in (Rogue / Bard). */
  skillExpertise: z.array(skillSchema).max(4).default([]),
  /**
   * How each level 2+ set its hit points: the die rolled (`roll`), or the
   * average (`method: "average"`, no die). A level without an entry gains the
   * average; legacy sheets have none.
   */
  hitPointRolls: z
    .array(
      z.object({
        level: z.number().int().min(2).max(20),
        roll: z.number().int().min(1).max(12).optional(),
        method: z.enum(["average", "roll", "table"]).optional(),
      }),
    )
    .max(19)
    .optional(),

  /** Entered by the player (no default; the form offers a "suggested" fill). */
  baseAbilityScores: abilityScoreBlockSchema,
  /** How the player allocated the background's +2/+1 (or +1/+1/+1). */
  backgroundAbilityBonuses: abilityBonusBlockSchema,

  /** Weapons carried. */
  weapons: z.array(itemSchema).max(50).default([]),
  /** Armour pieces; the `armor.equipped` ones drive AC / speed. */
  armors: z.array(itemSchema).max(50).default([]),
  /** Tools carried. */
  tools: z.array(itemSchema).max(50).default([]),
  /** Free inventory lines. */
  inventory: z.array(itemSchema).max(300).default([]),
  money: moneySchema.default(ZERO_MONEY),
  /**
   * Tool proficiencies the player picked (catalogue ids): class / background
   * "one of a group" choices. Fixed class + background grants are computed, not
   * stored here.
   */
  toolProficiencies: z.array(z.string()).max(20).default([]),
  /** Tools the character has expertise in (catalogue ids). */
  toolExpertise: z.array(z.string()).max(4).default([]),
  /** Weapon item ids the player assigned a Weapon Mastery slot to. */
  weaponMasteries: z.array(z.string()).max(6).default([]),
  /** Druid: the beasts known for Wild Shape (monster ids), as many as the level allows. */
  wildShapeForms: z.array(monsterIdSchema).max(8).default([]),
  /** Creatures that follow the character: its familiar. */
  companions: z.array(companionSchema).max(4).default([]),
  /**
   * Every « pick N of these » the player has resolved — class skills, species
   * lineage, starting-equipment package, subclass, feats, level slots… Which
   * ones are open is computed by `resolveChoices()`, never stored.
   *
   * Older sheets carry none: their equivalent picks live in the dedicated fields
   * above, and `normalizeChoices()` projects them when the engine needs a
   * uniform view.
   */
  choices: z.array(choicePickSchema).max(80).default([]),
  /**
   * Which wizard step the player stopped on, 1-5. Only meaningful while the
   * sheet is a draft; a finished sheet carries nothing.
   */
  creationStep: z.number().int().min(1).max(5).optional(),
});
export type Dnd2024CharacterInput = z.infer<typeof dnd2024CharacterInputSchema>;

/** One computed weapon-attack line on the derived block. */
export const derivedWeaponAttackSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  ability: z.enum(["str", "dex", "cha"]),
  attackBonus: z.number().int(),
  damageDice: z.string(),
  damageBonus: z.number().int(),
  damageType: damageTypeSchema,
  proficient: z.boolean(),
  mastery: weaponMasterySchema.nullable(),
  masteryActive: z.boolean(),
  /** Set on the always-available Unarmed Strike line. */
  unarmed: z.boolean().optional(),
  /** Set on the Warlock's pact weapon (attacks with Charisma). */
  pact: z.boolean().optional(),
});
export type DerivedWeaponAttack = z.infer<typeof derivedWeaponAttackSchema>;

/** A species area attack resolved by a save (Dragonborn Breath Weapon). */
export const derivedSpeciesAttackSchema = z.object({
  name: z.string(),
  saveAbility: z.literal("dex"),
  saveDc: z.number().int(),
  onSuccess: z.literal("half"),
  damageDice: z.string(),
  damageKind: damageKindSchema,
  shapes: z.string(),
  usesPerLongRest: z.number().int(),
});
export type DerivedSpeciesAttack = z.infer<typeof derivedSpeciesAttackSchema>;

/** Denormalised 5e block, recomputed on every write. */
export const dnd2024DerivedSchema = z.object({
  adjustedAbilityScores: abilityScoreBlockSchema,
  abilityModifiers: abilityModifierBlockSchema,
  maxHitPoints: z.number().int().min(1),
  proficiencyBonus: z.number().int().min(2),
  /** AC from the equipped armour (10 + Dex when unarmoured). */
  armorClass: z.number().int().default(10),
  /** Walking speed in feet (species base, armour, and what the features add). */
  speed: z.number().int().default(30),
  /** Climb / fly speeds in feet (Arpenteur, Monte-en-l'air); `0` = none. */
  climbSpeed: z.number().int().default(0),
  flySpeed: z.number().int().default(0),
  /** Dexterity + the features' bonuses (Vigilant…); absent on a sheet saved before them. */
  initiativeBonus: z.number().int().optional(),
  /** Advantage on initiative (Instinct sauvage…). */
  initiativeAdvantage: z.boolean().default(false),
  /** Saving throws the character is proficient in; absent = the class's. */
  proficientSaves: z.array(abilitySchema).optional(),
  /** Blindsight / tremorsense ranges in feet; `0` = none. */
  blindsight: z.number().int().default(0),
  tremorsense: z.number().int().default(0),
  /** Cantrips known beyond the class table (Ordre primitif : Magicien…). */
  bonusCantrips: z.number().int().default(0),
  /** Lowest natural d20 that is a critical hit. */
  critRange: z.number().int().min(2).max(20).default(20),
  /** Advantages the features grant (a `condition` only reminds). */
  advantages: z
    .array(
      z.object({
        on: d20RollSchema,
        abilities: z.array(abilitySchema).optional(),
        skills: z.array(skillSchema).optional(),
        condition: z.string().optional(),
        source: z.string(),
      }),
    )
    .default([]),
  /** Flat damage bonuses the roll sheet adds (Incantation puissante…). */
  damageBonuses: z
    .array(
      z.object({
        on: damageTargetSchema,
        school: spellSchoolSchema.optional(),
        flat: z.number().int(),
        source: z.string(),
      }),
    )
    .default([]),
  /** `false` when equipped armour is outside the class's training. */
  armorProficient: z.boolean().default(true),
  /** Weapon Mastery slots at the character's level (0 if the class has none). */
  masterySlots: z.number().int().default(0),
  /** Every skill the character is proficient in (class choices + background). */
  proficientSkills: z.array(skillSchema).default([]),
  /** Final skill-check modifiers (ability mod + proficiency / expertise). */
  skillModifiers: skillModifierBlockSchema,
  /** Final saving-throw modifiers per ability. */
  savingThrowModifiers: abilityModifierBlockSchema,
  /** 10 + Perception modifier. */
  passivePerception: z.number().int(),
  /** Check modifier per tool, keyed by catalogue id. */
  toolCheckModifiers: z.record(z.string(), z.number()).default({}),
  /** One line per catalogue-backed weapon carried. */
  weaponAttacks: z.array(derivedWeaponAttackSchema).default([]),
  /** The always-available Unarmed Strike line (optional on legacy stored docs). */
  unarmedStrike: derivedWeaponAttackSchema.optional(),
  /** Monk Martial Arts applies: no armour, no shield (Unarmed Strike as a Bonus Action). */
  martialArts: z.boolean().default(false),
  /** A save-based area attack from the species (Drakéide « Souffle »), or `null`. */
  speciesAttack: derivedSpeciesAttackSchema.nullable().default(null),
  /** Darkvision range in feet (species, lineage, Vision du diable); `0` = none. */
  /** Creature size (species size, or the one the player picked when it offers a choice). */
  size: creatureSizeSchema.default("medium"),
  darkvision: z.number().int().default(0),
  /** Truesight range in feet (Vision sorcière); `0` = none. */
  truesight: z.number().int().default(0),
  /** Swim speed in feet (Présent des profondeurs); `0` = none. */
  swimSpeed: z.number().int().default(0),
  /** Damage types resisted through the species. */
  resistances: z.array(damageKindSchema).default([]),
  /** Save DC / attack bonus of the species-granted spells, or `null`. */
  speciesSpellcasting: z
    .object({
      ability: abilitySchema,
      saveDc: z.number().int(),
      attackBonus: z.number().int(),
    })
    .nullable()
    .default(null),
  /** Reminders about automatic base-class attack / damage modifiers. */
  combatNotes: z.array(z.string()).default([]),
  /** Combat options usable as a Bonus Action. */
  bonusActions: z.array(z.string()).default([]),
  /** The class's hit die (`d{hitDie}`). */
  hitDie: z.number().int().default(8),
  /** Ability that powers spellcasting (`null` for non-casters). */
  spellcastingAbility: abilitySchema.nullable().default(null),
  /** 8 + proficiency + spellcasting modifier. */
  spellSaveDc: z.number().int().nullable().default(null),
  /** proficiency + spellcasting modifier. */
  spellAttackBonus: z.number().int().nullable().default(null),
  /** Max spell slots by spell level (`"1"`–`"9"`); `{}` for non-casters. */
  spellSlots: z.record(z.string(), z.number().int()).default({}),
  /** Warlock Pact Magic (slots of one level, short-rest recovery), or `null`. */
  pactMagic: z
    .object({ count: z.number().int(), level: z.number().int() })
    .nullable()
    .default(null),
  /** Spells a class feature grants "always prepared" (Druide, Rôdeur…). */
  grantedSpells: z.array(grantedSpellSchema).default([]),
  /**
   * Subclass id, read back from `choices` — denormalised here rather than stored
   * on the input so the two can never disagree. `null` below level 3.
   */
  subclassId: z.string().nullable().default(null),
  /**
   * Every feat the character holds: the background's origin feat, the fighting
   * style, and whatever was taken at a level slot. Also read back from
   * `choices`.
   */
  featIds: z.array(z.string()).default([]),
});
export type Dnd2024DerivedFields = z.infer<typeof dnd2024DerivedSchema>;

export const dnd2024CharacterSchema = auditFieldsSchema
  .merge(dnd2024CharacterInputSchema)
  .merge(dnd2024DerivedSchema)
  .extend(characterStoredFields);
export type Dnd2024Character = z.infer<typeof dnd2024CharacterSchema>;

/** @deprecated use {@link dnd2024DerivedSchema} */
export const characterDerivedSchema = dnd2024DerivedSchema;
/** @deprecated use {@link Dnd2024DerivedFields} */
export type CharacterDerivedFields = Dnd2024DerivedFields;

// ===========================================================================
// Unions
// ===========================================================================

/**
 * Player-entered fields. Discriminated by `system` — a `standard` sheet has a
 * handful of fields; a `dnd2024` sheet carries the full 5e input.
 */
export const characterInputSchema = z.discriminatedUnion("system", [
  standardCharacterInputSchema,
  dnd2024CharacterInputSchema,
]);
export type CharacterInput = z.infer<typeof characterInputSchema>;

/**
 * A finished sheet, discriminated by `system`. The common surface (`name`,
 * `color`, `imageUrl`, `imageCrop`, `maxHitPoints`, `inventory`) is what the
 * session engine relies on, which is why only these may enter a session.
 */
export const readyCharacterSchema = z.discriminatedUnion("system", [
  standardCharacterSchema,
  dnd2024CharacterSchema,
]);
export type ReadyCharacter = z.infer<typeof readyCharacterSchema>;

// ===========================================================================
// Drafts — a sheet saved before it is playable
// ===========================================================================

/**
 * Player-entered fields of a draft: the same shape as a finished sheet with
 * everything optional. `system` stays required — it is chosen up front and
 * decides which form the player is filling in.
 */
export const standardCharacterDraftInputSchema = standardCharacterInputSchema
  .partial()
  .extend({ system: z.literal("standard") });
export type StandardCharacterDraftInput = z.infer<typeof standardCharacterDraftInputSchema>;

/**
 * Every player-entered 5e field turns optional; the derived block is absent
 * entirely, since it cannot be computed without a class and six scores.
 */
export const dnd2024CharacterDraftInputSchema = dnd2024CharacterInputSchema.partial().extend({
  system: z.literal("dnd2024"),
  /**
   * Per-ability, not all-or-nothing: a player who has entered three of the six
   * scores must get those three back. The finished sheet still requires the
   * complete block.
   */
  baseAbilityScores: abilityScoreBlockSchema.partial().optional(),
});
export type Dnd2024CharacterDraftInput = z.infer<typeof dnd2024CharacterDraftInputSchema>;

export const characterDraftInputSchema = z.discriminatedUnion("system", [
  standardCharacterDraftInputSchema,
  dnd2024CharacterDraftInputSchema,
]);
export type CharacterDraftInput = z.infer<typeof characterDraftInputSchema>;

/**
 * What a stored draft still guarantees. `name` loses its `min(1)`: a player may
 * save before settling on one, and the lists fall back to « Sans nom ».
 */
const characterDraftCommonFields = {
  status: z.literal("draft"),
  ownerId: z.string().min(1),
  name: z.string().max(120),
};

export const standardCharacterDraftSchema = auditFieldsSchema
  .merge(standardCharacterDraftInputSchema)
  .extend(characterDraftCommonFields);
export type StandardCharacterDraft = z.infer<typeof standardCharacterDraftSchema>;

export const dnd2024CharacterDraftSchema = auditFieldsSchema
  .merge(dnd2024CharacterDraftInputSchema)
  .extend(characterDraftCommonFields);
export type Dnd2024CharacterDraft = z.infer<typeof dnd2024CharacterDraftSchema>;

export const characterDraftSchema = z.discriminatedUnion("system", [
  standardCharacterDraftSchema,
  dnd2024CharacterDraftSchema,
]);
export type CharacterDraft = z.infer<typeof characterDraftSchema>;

// ===========================================================================
// The stored document
// ===========================================================================

/**
 * `characters/{characterId}` — a top-level character sheet owned by a player,
 * reusable across campaigns and adventures.
 *
 * Two levels of discrimination: `status` separates a draft from a playable
 * sheet, `system` picks the rules module. Legacy docs carry no `status` and
 * parse as `ready` (see {@link DEFAULT_CHARACTER_STATUS}) — but note that
 * `parseDoc` returns raw data, so that default must also be applied in code.
 */
export const characterSchema = z.union([characterDraftSchema, readyCharacterSchema]);
export type Character = z.infer<typeof characterSchema>;

/**
 * Narrow to a draft — the half-filled sheets that must be kept out of
 * campaigns and sessions.
 */
export function isCharacterDraft<T extends { status?: string }>(
  value: T,
): value is Extract<T, { status: "draft" }> {
  return value.status === "draft";
}

/**
 * Narrow a character (or input) to the 5e 2024 variant.
 *
 * Note this says nothing about {@link isCharacterDraft}: on a stored
 * `Character` it yields « finished sheet *or* draft », so the 5e fields stay
 * optional until the draft is ruled out. That is deliberate — it is what makes
 * the compiler point at any code reading `maxHitPoints` & co. off a draft.
 */
export function isDnd2024Character<T extends { system: string }>(
  value: T,
): value is Extract<T, { system: "dnd2024" }> {
  return value.system === "dnd2024";
}

// ===========================================================================
// Belongings — the part of a sheet only its owner and the GM read
// ===========================================================================

/** `characters/{id}/private/belongings`. A field a system has not is absent. */
export const characterBelongingsSchema = z.object({
  inventory: z.array(itemSchema).max(300).optional(),
  money: moneySchema.optional(),
  experiencePoints: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
});
export type CharacterBelongings = z.infer<typeof characterBelongingsSchema>;
