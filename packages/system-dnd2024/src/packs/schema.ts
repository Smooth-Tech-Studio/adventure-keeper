/**
 * The content-pack format, `ak-pack/1`: what a player writes (or imports) to add
 * species, backgrounds, subclasses, feats, spells and monsters on top of the
 * SRD. A pack only **adds** content — it never replaces or removes an SRD entry.
 *
 * Ids inside a pack are short slugs (`"voie-du-zelateur"`); the registry
 * namespaces them with the pack id (`"mon-pack:voie-du-zelateur"`), so two
 * packs can never collide with each other or with the SRD. A reference to
 * another entry (a background's origin feat, a lineage's spell) is resolved the
 * same way: a slug defined in the same pack points there, anything else is
 * taken as an SRD id, and a full `"pack:slug"` id is kept as is.
 *
 * The schemas mirror the engine's own types (`SpeciesDef`, `FeatDef`…); the
 * conversion in `registry.ts` is what keeps the two in step at compile time.
 */

import { z } from "zod";
import { abilityScoreBlockSchema, abilitySchema } from "../abilities";
import { armorCategorySchema } from "../armors";
import {
  damageTypeSchema,
  weaponCategorySchema,
  weaponMasterySchema,
  weaponPropertySchema,
} from "../weapons";
import { languageIdSchema } from "../languages";
import { diceSchema } from "../dice";
import { choiceKindSchema, choicePoolSchema } from "../choices";
import { classIdSchema } from "../classes";
import { dicePoolSchema } from "../dice";
import { featCategorySchema } from "../feats";
import { monsterTypeSchema } from "../monsters";
import { skillSchema } from "../skills";
import { TOOL_CHOICE_GROUPS, toolCategorySchema } from "../tools";
import { creatureSizeSchema } from "../species";
import { damageKindSchema, spellDamageSchema, spellSaveSchema, spellSchoolSchema } from "../spells";
import { LOCALES, localized } from "../locale";
import { amountSchema, mechanicSchema } from "../mechanics";
import { packTranslationsSchema } from "./translations";

export const CONTENT_PACK_FORMAT = "ak-pack/1";

/** How a pack file names its game: the fifth edition. */
export const PACK_SYSTEM = "5e";

/** Lower-case letters, digits and single dashes: `voie-du-zelateur`. */
export const PACK_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `"pack:slug"` — how a pack entry is referenced outside its pack (see
 * `registry.ts`). The slug may be camelCase: the SRD's few camelCase ids
 * (`commonSign`) predate the format.
 */
export const PACK_ENTRY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z][a-zA-Z0-9]*(?:-[a-z0-9]+)*$/;
export const packEntryIdSchema = z.string().regex(PACK_ENTRY_ID);

const slug = z
  .string()
  .regex(PACK_SLUG, "minuscules, chiffres et tirets uniquement (ex. « voie-du-zelateur »)");
const text = (max: number) => z.string().trim().min(1).max(max);
const level = z.number().int().min(1).max(20);
const feet = z.number().int().min(0).max(300);

/**
 * A language, written in the pack (its slug), in the SRD (`"elvish"`) or in
 * another pack (`"autre-pack:slug"`).
 */
const languageRefSchema = z.union([languageIdSchema, slug, packEntryIdSchema]);

// --- Species ------------------------------------------------------------------

const lineageSpellGrantSchema = z.object({
  spellId: z.string().min(1),
  minLevel: level,
  spellLevel: z.number().int().min(0).max(9),
});

const lineageSchema = z.object({
  speed: feet.optional(),
  darkvision: feet.optional(),
  resistances: z.array(damageKindSchema).optional(),
  spells: z.array(lineageSpellGrantSchema).optional(),
  /** The damage of the species' breath weapon with this option (the Dragonborn's ancestry). */
  breathDamage: damageKindSchema.optional(),
  summary: text(400),
});

/**
 * Uses per rest: `max` is a number, `"prof"`, `"level"`, an ability modifier
 * (`{ "ability": "cha", "min": 1 }`), a multiple of the level (`{ "perLevel":
 * 5 }`) or a table (`{ "byLevel": [[2, 2], [6, 3]] }`) — see `mechanics.ts`.
 */
const featureUsesSchema = z.object({
  max: amountSchema,
  recharge: z.enum(["short", "long"]),
  shortFrom: level.optional(),
});

/** What using a feature rolls (`feature-rolls.ts`): hit points or temporary ones. */
const featureRollSchema = z.object({
  dice: z.union([dicePoolSchema, z.object({ martialArts: z.number().int().min(1).max(4) })]),
  bonus: z.union([z.literal("level"), abilitySchema]).optional(),
  gives: z.enum(["hp", "tempHp"]),
  label: text(80).optional(),
  /** The feature whose pool it spends a point of, by id (`"monk:2:Credo du Moine"`). */
  spends: z.string().min(1).optional(),
});

/** What a trait, a feature or a feat changes on the sheet (`mechanics.ts`). */
const mechanicsSchema = z.array(mechanicSchema).max(20);

/** A species trait — the engine keeps those apart from `SpeciesDef` (see `features.ts`). */
const speciesTraitSchema = z.object({
  name: text(80),
  summary: text(400),
  uses: featureUsesSchema.optional(),
  mechanics: mechanicsSchema.optional(),
  roll: featureRollSchema.optional(),
});

export const packSpeciesSchema = z
  .object({
    id: slug,
    name: text(80),
    blurb: text(160),
    imageUrl: z.url().optional(),
    size: z.union([creatureSizeSchema, z.array(creatureSizeSchema).min(1).max(2)]),
    speed: feet,
    darkvision: feet.default(0),
    choice: z.object({ label: text(80), options: z.array(text(80)).min(2) }).optional(),
    lineages: z.record(z.string(), lineageSchema).optional(),
    spellsUseChosenAbility: z.boolean().optional(),
    spells: z.array(lineageSpellGrantSchema).optional(),
    spellsTrait: text(80).optional(),
    resistances: z.array(damageKindSchema).optional(),
    skillGrant: z
      .object({
        trait: text(80),
        count: z.number().int().min(1).max(18),
        from: z.union([z.array(skillSchema).min(1), z.literal("any")]),
      })
      .optional(),
    traits: z.array(speciesTraitSchema).default([]),
    /** Languages the species grants, on top of the base ones. */
    languages: z.array(languageRefSchema).optional(),
    /** Extra hit points per character level (« Ténacité naine »). */
    hitPointsPerLevel: z.number().int().min(1).max(5).optional(),
    /** An Origin feat the species lets the player pick, named after its trait (« Polyvalent »). */
    originFeatGrant: z.object({ trait: text(80) }).optional(),
    /** A saving-throw area attack (« Souffle »); its damage comes from the option picked. */
    breathWeapon: z
      .object({
        name: text(80),
        save: z.literal("dex"),
        onSuccess: z.literal("half"),
        baseDice: dicePoolSchema,
        shapes: text(120),
      })
      .optional(),
    /** One size larger for the carrying capacity (« Forte carrure »). */
    powerfulBuild: z.boolean().optional(),
    /** The trait that tells every option of `choice`; the sheet shows the option picked in its place. */
    lineageTrait: text(80).optional(),
  })
  .superRefine((species, ctx) => {
    const options = new Set(species.choice?.options ?? []);
    for (const key of Object.keys(species.lineages ?? {})) {
      if (!options.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lineages", key],
          message: `« ${key} » n'est pas une des options de « choice »`,
        });
      }
    }
  });
export type PackSpecies = z.infer<typeof packSpeciesSchema>;

// --- Choices ------------------------------------------------------------------

/** A pick an entry opens (a feat's, a starting kit's). Its id is a slug; the registry makes it unique. */
const packChoiceSchema = z.object({
  id: slug,
  kind: choiceKindSchema,
  label: text(120),
  count: z.number().int().min(1).max(20),
  pool: choicePoolSchema,
  minLevel: level.optional(),
  hint: text(200).optional(),
});

/**
 * A class, written in the pack (`"mon-pack"` → `"barde-des-brumes"`), in the
 * SRD (`"wizard"`) or in another pack (`"autre-pack:slug"`) — see
 * `resolvePackRef`.
 */
export const classRefSchema = z.union([classIdSchema, slug, packEntryIdSchema]);

// --- Backgrounds --------------------------------------------------------------

/**
 * One line of a starting kit: a catalogue item (`id`), or whatever one of the
 * background's own choices resolved to (`fromChoice`: that choice's slug, e.g.
 * `"tool"` for the artisan's tools the background let the player pick).
 */
const packKitItemSchema = z
  .object({
    kind: z.enum(["weapon", "armor", "tool", "gear", "pack"]),
    id: z.string().min(1).optional(),
    qty: z.number().int().min(1).max(100).optional(),
    fromChoice: slug.optional(),
  })
  .refine((item) => Boolean(item.id) !== Boolean(item.fromChoice), {
    message: "« id » ou « fromChoice », l'un des deux",
  });

export const packBackgroundSchema = z.object({
  id: slug,
  name: text(80),
  blurb: text(160),
  imageUrl: z.url().optional(),
  abilityOptions: z.array(abilitySchema).length(3),
  skillProficiencies: z.tuple([skillSchema, skillSchema]).optional(),
  toolProficiency: z
    .union([
      z.object({ label: text(80), toolId: z.string().min(1) }),
      z.object({ label: text(80), choice: z.enum(["artisan", "instrument", "gaming"]) }),
    ])
    .optional(),
  originFeatId: z.string().min(1).optional(),
  /** The background's package (the « 50 po instead » option is always added). */
  startingKit: z
    .object({
      items: z.array(packKitItemSchema),
      gold: z.number().int().min(0).max(10000),
      choices: z.array(packChoiceSchema).optional(),
    })
    .optional(),
});
export type PackBackground = z.infer<typeof packBackgroundSchema>;

// --- Subclasses ---------------------------------------------------------------

export const packSubclassSchema = z.object({
  id: slug,
  classId: classRefSchema,
  name: text(80),
  blurb: text(160),
  imageUrl: z.url().optional(),
  features: z
    .array(
      z.object({
        level,
        name: text(80),
        summary: text(600),
        uses: featureUsesSchema.optional(),
        mechanics: mechanicsSchema.optional(),
        roll: featureRollSchema.optional(),
      }),
    )
    .default([]),
  /** Spells always prepared, by class level (`minLevel`). */
  spells: z.array(lineageSpellGrantSchema).optional(),
  /** Or several lists, one picked (an environment, a patron's aspect…). */
  spellVariants: z
    .object({
      label: text(80),
      hint: text(200).optional(),
      options: z
        .array(
          z.object({
            name: text(80),
            summary: text(400),
            spells: z.array(lineageSpellGrantSchema),
          }),
        )
        .min(2),
    })
    .optional(),
});
export type PackSubclass = z.infer<typeof packSubclassSchema>;

// --- Classes ------------------------------------------------------------------

/** A value by level, 1 → 20. */
const byLevelSchema = z.array(z.number().int().min(0).max(30)).length(20);
/** A count that steps up: `[{ "level": 1, "count": 2 }, { "level": 6, "count": 4 }]`. */
const levelStepsSchema = z
  .array(z.object({ level, count: z.number().int().min(0).max(20) }))
  .min(1);

/**
 * A class: its numbers, what it turns on in the engine (spell slots, Wild
 * Shape, invocations…), its tables and its features. A pack class never
 * replaces an SRD class; its subclasses and spells name it by its slug.
 */
export const packClassSchema = z.object({
  id: slug,
  name: text(80),
  blurb: text(160),
  imageUrl: z.url().optional(),
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  complexity: z.enum(["low", "average", "high"]).default("average"),
  primaryAbility: z.array(abilitySchema).min(1).max(2),
  savingThrows: z.tuple([abilitySchema, abilitySchema]),
  /** Scores the form suggests (the standard array, assigned for the class). */
  suggestedScores: abilityScoreBlockSchema,
  skillChoices: z.object({
    count: z.number().int().min(0).max(18),
    from: z.array(skillSchema).min(1),
  }),
  armorTraining: z.array(armorCategorySchema).default([]),
  weaponProficiency: z.object({
    simple: z.boolean(),
    martial: z.union([z.boolean(), z.literal("finesse-or-light"), z.literal("light")]),
  }),
  toolProficiencies: z.array(z.string().min(1)).default([]),
  toolChoice: z
    .object({ count: z.number().int().min(1).max(5), from: z.enum(TOOL_CHOICE_GROUPS) })
    .optional(),

  // What the class turns on in the engine.
  spellcasting: z.enum(["full", "half", "pact"]).optional(),
  spellcastingAbility: abilitySchema.optional(),
  cantripsKnown: byLevelSchema.optional(),
  preparedSpells: byLevelSchema.optional(),
  expertise: levelStepsSchema.optional(),
  toolExpertise: z.number().int().min(1).max(5).optional(),
  martialArts: z
    .array(z.object({ level, die: diceSchema }))
    .min(1)
    .optional(),
  wildShapeFrom: level.optional(),
  invocationsKnown: byLevelSchema.optional(),
  weaponMastery: levelStepsSchema.optional(),
  /** The levels of the Ability Score Improvement feat: 4, 8, 12 and 16 when absent. */
  asiLevels: z.array(level).max(10).optional(),
  fightingStyleLevel: level.optional(),
  languages: z.array(languageRefSchema).optional(),
  languagePicks: z.number().int().min(1).max(5).optional(),
  /** What its subclass is called (« Voie », « Serment »…). */
  subclassLabel: text(40).optional(),
  /** One more skill from the class list, at a level (the Barbarian's Savoir primal). */
  bonusSkill: z.object({ id: slug, minLevel: level, label: text(80), hint: text(200) }).optional(),
  /** Spells always prepared, from a level; `label` names the feature that grants them. */
  spells: z.array(lineageSpellGrantSchema.extend({ label: text(80).optional() })).optional(),
  /**
   * The class's packages, one taken: items and gold, or — without `label` —
   * gold only (« 75 po »).
   */
  startingEquipment: z
    .object({
      options: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z]$/, "une lettre : « a », « b »…"),
            label: text(80).optional(),
            items: z.array(packKitItemSchema).default([]),
            gold: z.number().int().min(0).max(10000),
            choices: z.array(packChoiceSchema).optional(),
          }),
        )
        .min(1),
    })
    .optional(),
  /** The « au choix » of the class table: one option picked at a level (Ordre primitif…). */
  options: z
    .array(
      z.object({
        slug,
        level,
        label: text(80),
        options: z
          .array(
            z.object({
              id: slug,
              name: text(80),
              summary: text(400),
              mechanics: mechanicsSchema.optional(),
            }),
          )
          .min(2),
      }),
    )
    .optional(),
  features: z
    .array(
      z.object({
        level,
        name: text(80),
        summary: text(600),
        uses: featureUsesSchema.optional(),
        mechanics: mechanicsSchema.optional(),
        roll: featureRollSchema.optional(),
      }),
    )
    .default([]),
});
export type PackClass = z.infer<typeof packClassSchema>;

// --- Feats --------------------------------------------------------------------

const featEffectsSchema = z.object({
  hitPointsPerLevel: z.number().int().min(1).max(10).optional(),
  rangedAttackBonus: z.number().int().min(1).max(5).optional(),
  duelingDamageBonus: z.number().int().min(1).max(5).optional(),
  thrownDamageBonus: z.number().int().min(1).max(5).optional(),
  armoredAcBonus: z.number().int().min(1).max(5).optional(),
  armorTraining: z.array(armorCategorySchema).min(1).optional(),
  unarmedDamageDice: dicePoolSchema.optional(),
  heavyWeaponProficiencyDamage: z.boolean().optional(),
});

export const packFeatSchema = z.object({
  id: slug,
  name: text(80),
  category: featCategorySchema,
  blurb: text(160).optional(),
  summary: text(600),
  repeatable: z.boolean().optional(),
  minLevel: level.optional(),
  prerequisite: text(160).optional(),
  choices: z.array(packChoiceSchema).optional(),
  /** +1 to one of `options` (or any ability), up to `max` — 20 by default, 30 for an epic boon. */
  abilityIncrease: z
    .object({
      options: z.union([z.array(abilitySchema).min(1).max(6), z.literal("any")]),
      max: z.number().int().min(1).max(30).optional(),
    })
    .optional(),
  effects: featEffectsSchema.optional(),
  /** What the feat changes beyond `effects` (initiative, saves, speed…). */
  mechanics: mechanicsSchema.optional(),
  /** Shown in the sheet's combat block. */
  combatNote: text(400).optional(),
  /** A bonus action the feat adds, shown with the others. */
  bonusAction: text(160).optional(),
});
export type PackFeat = z.infer<typeof packFeatSchema>;

// --- Spells -------------------------------------------------------------------

export const packSpellSchema = z.object({
  id: slug,
  name: text(80),
  level: z.number().int().min(0).max(9),
  school: spellSchoolSchema,
  classes: z.array(classRefSchema),
  castingTime: text(60),
  range: text(60),
  components: z.object({ v: z.boolean(), s: z.boolean(), m: z.boolean() }),
  duration: text(60),
  concentration: z.boolean(),
  ritual: z.boolean(),
  summary: text(600).optional(),
  damage: spellDamageSchema.optional(),
  save: spellSaveSchema.optional(),
  attackRoll: z.boolean().optional(),
});
export type PackSpell = z.infer<typeof packSpellSchema>;

// --- Monsters -----------------------------------------------------------------

export const packMonsterSchema = z.object({
  id: slug,
  name: text(80),
  type: monsterTypeSchema,
  size: creatureSizeSchema,
  cr: z.string().regex(/^(0|1\/8|1\/4|1\/2|[1-9]\d?)$/, "FP attendu : 0, 1/8, 1/4, 1/2 ou 1 à 30"),
  armorClass: z.number().int().min(1).max(40),
  hitPoints: z.number().int().min(1).max(2000),
  speed: feet.default(30),
  attacks: z
    .array(
      z.object({
        name: text(80),
        toHit: z.number().int().min(-5).max(30),
        reach: text(40).optional(),
        damage: z.object({ count: z.number().int().min(0).max(40), die: diceSchema }),
        damageBonus: z.number().int().min(-10).max(50),
        damageKind: damageKindSchema,
        note: text(600).optional(),
      }),
    )
    .optional(),
  /** A beast's Strength, Dexterity, Constitution and other speeds (Wild Shape, familiars). */
  beast: z
    .object({
      str: z.number().int().min(1).max(30),
      dex: z.number().int().min(1).max(30),
      con: z.number().int().min(1).max(30),
      climb: feet.optional(),
      swim: feet.optional(),
      fly: feet.optional(),
    })
    .optional(),
});
export type PackMonster = z.infer<typeof packMonsterSchema>;

// --- Invocations --------------------------------------------------------------

/** An Eldritch Invocation, for a class with `invocationsKnown` (the Warlock). */
export const packInvocationSchema = z.object({
  id: slug,
  name: text(80),
  /** Class level needed to take it, `0` for none. */
  minLevel: z.number().int().min(0).max(20),
  /** Another invocation that must be taken first: one of this pack, or the SRD's. */
  requires: z.string().min(1).optional(),
  /** A prerequisite the sheet cannot check, shown as a hint. */
  condition: text(200).optional(),
  summary: text(600),
  repeatable: z.boolean().optional(),
  /** Tied to one of the character's cantrips: one that deals damage, or that attacks. */
  cantrip: z.enum(["damage", "attack"]).optional(),
  /** Spells cast without a slot, listed as always prepared. */
  spells: z
    .array(z.object({ spellId: z.string().min(1), spellLevel: z.number().int().min(0).max(9) }))
    .optional(),
  /** AC without body armour: this + Dexterity. */
  unarmoredAc: z.number().int().min(10).max(20).optional(),
  darkvision: feet.optional(),
  truesight: feet.optional(),
  /** A swimming speed equal to the walking speed. */
  swimSpeed: z.boolean().optional(),
});
export type PackInvocation = z.infer<typeof packInvocationSchema>;

// --- Tools --------------------------------------------------------------------

/** A tool for the catalogue: a gaming set, an instrument, a set of artisan's tools… */
export const packToolSchema = z.object({
  id: slug,
  name: text(80),
  category: toolCategorySchema,
  ability: abilitySchema,
  priceCp: z.number().int().min(0).max(10_000_000),
  weightKg: z.number().min(0).max(1000),
  description: text(300).optional(),
});
export type PackTool = z.infer<typeof packToolSchema>;

// --- Languages ----------------------------------------------------------------

/** A language a character can speak. */
export const packLanguageSchema = z.object({
  /** Kebab-case; the SRD's three camelCase ids (`commonSign`) are kept as sheets store them. */
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:-[a-z0-9]+)*$/, "minuscules, chiffres et tirets"),
  name: text(80),
  /** Standard languages are offered to every character; rare ones on a pick. */
  kind: z.enum(["standard", "rare"]),
  /** Who speaks it, and where you would hear it. */
  summary: text(300),
});
export type PackLanguage = z.infer<typeof packLanguageSchema>;

// --- Equipment ----------------------------------------------------------------

const price = z.number().int().min(0).max(100_000_000);
const weight = z.number().min(0).max(5000);

/** A weapon for the catalogue: its numbers are what the sheet attacks with. */
export const packWeaponSchema = z.object({
  id: slug,
  name: text(80),
  category: weaponCategorySchema,
  /** Price in copper pieces. */
  priceCp: price,
  weightKg: weight.optional(),
  damageDice: dicePoolSchema.optional(),
  damageType: damageTypeSchema.optional(),
  properties: z.array(weaponPropertySchema).default([]),
  mastery: weaponMasterySchema.optional(),
  /** Thrown or ammunition range, in metres. */
  range: z.object({ normal: z.number().min(0), max: z.number().min(0) }).optional(),
  versatileDice: dicePoolSchema.optional(),
});
export type PackWeapon = z.infer<typeof packWeaponSchema>;

/** A suit of armour or a shield: what it does to the AC, the Stealth, the Speed. */
export const packArmorSchema = z.object({
  id: slug,
  name: text(80),
  category: armorCategorySchema,
  priceCp: price,
  weightKg: weight,
  /** Body armour's base AC. */
  baseAc: z.number().int().min(10).max(25).optional(),
  /** A shield's AC bonus. */
  acBonus: z.number().int().min(1).max(5).optional(),
  addsDex: z.boolean(),
  maxDex: z.number().int().min(0).max(10).optional(),
  strengthMin: z.number().int().min(1).max(30).optional(),
  stealthDisadvantage: z.boolean().default(false),
  description: text(300).optional(),
});
export type PackArmor = z.infer<typeof packArmorSchema>;

/** Adventuring gear. */
export const packGearSchema = z.object({
  id: slug,
  name: text(80),
  priceCp: price,
  weightKg: weight.optional(),
  /** A loose grouping for the picker (`"ammunition"`, `"focus"`…). */
  group: z.string().regex(PACK_SLUG).optional(),
  description: text(300).optional(),
});
export type PackGear = z.infer<typeof packGearSchema>;

/** A bundle of gear sold together (« Paquetage d'explorateur »). */
export const packEquipmentPackSchema = z.object({
  id: slug,
  name: text(80),
  priceCp: price,
  /** Gear of this pack or of the SRD, by id. */
  contents: z
    .array(z.object({ gearId: z.string().min(1), qty: z.number().int().min(1).max(1000) }))
    .min(1),
});
export type PackEquipmentPack = z.infer<typeof packEquipmentPackSchema>;

// --- The pack -----------------------------------------------------------------

export const PACK_CONTENT_KINDS = [
  "classes",
  "species",
  "backgrounds",
  "subclasses",
  "feats",
  "spells",
  "monsters",
  "invocations",
  "languages",
  "tools",
  "weapons",
  "armors",
  "gear",
  "equipmentPacks",
] as const;
export type PackContentKind = (typeof PACK_CONTENT_KINDS)[number];

export const PACK_CONTENT_KIND_LABELS: Record<PackContentKind, string> = localized({
  fr: {
    classes: "Classe",
    species: "Espèce",
    backgrounds: "Historique",
    subclasses: "Sous-classe",
    feats: "Don",
    spells: "Sort",
    monsters: "Monstre",
    invocations: "Manifestation occulte",
    languages: "Langue",
    tools: "Outil",
    weapons: "Arme",
    armors: "Armure",
    gear: "Matériel",
    equipmentPacks: "Paquetage",
  },
  en: {
    classes: "Class",
    species: "Species",
    backgrounds: "Background",
    subclasses: "Subclass",
    feats: "Feat",
    spells: "Spell",
    monsters: "Monster",
    invocations: "Eldritch invocation",
    languages: "Language",
    tools: "Tool",
    weapons: "Weapon",
    armors: "Armour",
    gear: "Gear",
    equipmentPacks: "Equipment pack",
  },
});

export const contentPackSchema = z.object({
  format: z.literal(CONTENT_PACK_FORMAT),
  /** `"5e"`; the older `"dnd2024"` is still read, silently. Stored as `"dnd2024"`. */
  system: z
    .preprocess((value) => (value === "dnd2024" ? PACK_SYSTEM : value), z.literal(PACK_SYSTEM))
    .transform(() => "dnd2024" as const),
  id: slug,
  name: text(80),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version attendue sous la forme 1.0.0")
    .default("1.0.0"),
  description: text(2000).optional(),
  author: text(80).optional(),
  /**
   * The language the pack is written in (`"fr"`, `"en"`). Absent means
   * French — every pack written before the field existed is.
   */
  language: z.enum(LOCALES).optional(),
  /** The pack in other languages: its texts only, by entry id (see `translations.ts`). */
  translations: packTranslationsSchema.optional(),
  content: z
    .object({
      classes: z.array(packClassSchema).default([]),
      species: z.array(packSpeciesSchema).default([]),
      backgrounds: z.array(packBackgroundSchema).default([]),
      subclasses: z.array(packSubclassSchema).default([]),
      feats: z.array(packFeatSchema).default([]),
      spells: z.array(packSpellSchema).default([]),
      monsters: z.array(packMonsterSchema).default([]),
      invocations: z.array(packInvocationSchema).default([]),
      languages: z.array(packLanguageSchema).default([]),
      tools: z.array(packToolSchema).default([]),
      weapons: z.array(packWeaponSchema).default([]),
      armors: z.array(packArmorSchema).default([]),
      gear: z.array(packGearSchema).default([]),
      equipmentPacks: z.array(packEquipmentPackSchema).default([]),
    })
    .prefault({}),
});

/** A validated pack — what the registry consumes and what export writes. */
export type ContentPack = z.infer<typeof contentPackSchema>;
/** What a pack file may contain before defaults are applied. */
export type ContentPackInput = z.input<typeof contentPackSchema>;
