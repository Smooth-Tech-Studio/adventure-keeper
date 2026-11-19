import { z } from "zod";
import type { Ability, AbilityModifierBlock } from "./abilities";
import { DICE_SIDES, dicePoolSchema, formatDicePool, type DicePool } from "./dice";
import { localized } from "./locale";

/**
 * 5e 2024 weapon **types and rules helpers**. The weapon *data* is not bundled
 * with the engine — it lives in the SRD pack's `srd/weapons.json`, which the
 * app loads on demand (`SRD_CATALOGS`), the same pattern used for spells. Only names + numbers + property labels are
 * modelled, no rules text.
 *
 * Ref: SRD 5.2 (CC-BY-4.0) weapon table.
 */

// --- Categories -------------------------------------------------------------

export const WEAPON_CATEGORIES = [
  "simple-melee",
  "simple-ranged",
  "martial-melee",
  "martial-ranged",
  // Not a weapon you attack with: a spellcasting focus (staff, orb, holy
  // symbol…). Kept in the weapon list because it is a caster's "weapon slot",
  // but it carries no damage die and never appears in the attack table.
  "focus",
] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];
export const weaponCategorySchema = z.enum(WEAPON_CATEGORIES);

export const WEAPON_CATEGORY_LABELS: Record<WeaponCategory, string> = localized({
  fr: {
    "simple-melee": "Arme courante de corps à corps",
    "simple-ranged": "Arme courante à distance",
    "martial-melee": "Arme de guerre de corps à corps",
    "martial-ranged": "Arme de guerre à distance",
    focus: "Focaliseur",
  },
  en: {
    "simple-melee": "Simple melee weapon",
    "simple-ranged": "Simple ranged weapon",
    "martial-melee": "Martial melee weapon",
    "martial-ranged": "Martial ranged weapon",
    focus: "Spellcasting focus",
  },
});

export function isMartialCategory(category: WeaponCategory): boolean {
  return category === "martial-melee" || category === "martial-ranged";
}

export function isRangedCategory(category: WeaponCategory): boolean {
  return category === "simple-ranged" || category === "martial-ranged";
}

// --- Damage types ---------------------------------------------------------

export const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
export const damageTypeSchema = z.enum(DAMAGE_TYPES);

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = localized({
  fr: {
    slashing: "tranchant",
    piercing: "perforant",
    bludgeoning: "contondant",
  },
  en: {
    slashing: "slashing",
    piercing: "piercing",
    bludgeoning: "bludgeoning",
  },
});

// --- Properties ----------------------------------------------------------

export const WEAPON_PROPERTIES = [
  "finesse",
  "light",
  "heavy",
  "reach",
  "thrown",
  "two-handed",
  "versatile",
  "ammunition",
  "loading",
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];
export const weaponPropertySchema = z.enum(WEAPON_PROPERTIES);

export const WEAPON_PROPERTY_LABELS: Record<WeaponProperty, string> = localized({
  fr: {
    finesse: "Finesse",
    light: "Légère",
    heavy: "Lourde",
    reach: "Allonge",
    thrown: "Lancer",
    "two-handed": "Deux mains",
    versatile: "Polyvalente",
    ammunition: "Munitions",
    loading: "Chargement",
  },
  en: {
    finesse: "Finesse",
    light: "Light",
    heavy: "Heavy",
    reach: "Reach",
    thrown: "Thrown",
    "two-handed": "Two-Handed",
    versatile: "Versatile",
    ammunition: "Ammunition",
    loading: "Loading",
  },
});

/** What each property does, in our own words (mechanics, not rulebook prose). */
export const WEAPON_PROPERTY_DESCRIPTIONS: Record<WeaponProperty, string> = localized({
  fr: {
    finesse:
      "Au choix, utilisez Force ou Dextérité pour les jets d'attaque et de dégâts de cette arme.",
    light:
      "Après une attaque avec une arme Légère pendant l'action Attaque, vous pouvez attaquer avec une autre arme Légère en action Bonus (sans ajouter votre modificateur de caractéristique aux dégâts).",
    heavy:
      "Vous avez un désavantage aux jets d'attaque si votre Force (arme de corps à corps) ou votre Dextérité (arme à distance) est inférieure à 13.",
    reach: "Ajoute 1,50 m à votre allonge avec cette arme, attaques d'opportunité comprises.",
    thrown:
      "Vous pouvez lancer l'arme pour une attaque à distance, en utilisant la même caractéristique qu'au corps à corps.",
    "two-handed": "L'arme doit être tenue à deux mains pour attaquer.",
    versatile:
      "Utilisable à une ou deux mains ; à deux mains, un coup au but inflige les dégâts indiqués entre parenthèses.",
    ammunition:
      "Nécessite des munitions ; en dégainer une fait partie de l'attaque. On récupère environ la moitié des munitions dépensées après le combat.",
    loading:
      "Une seule attaque avec cette arme par action, action Bonus ou réaction, même si vous disposez de plusieurs attaques.",
  },
  en: {
    finesse: "Use your choice of Strength or Dexterity for this weapon's attack and damage rolls.",
    light:
      "After attacking with a Light weapon as part of the Attack action, you can attack with another Light weapon as a Bonus Action (without adding your ability modifier to its damage).",
    heavy:
      "You have disadvantage on attack rolls if your Strength (melee weapon) or Dexterity (ranged weapon) is below 13.",
    reach: "Adds 5 feet to your reach with this weapon, opportunity attacks included.",
    thrown: "You can throw the weapon to make a ranged attack, using the same ability as in melee.",
    "two-handed": "The weapon must be held in two hands to attack with it.",
    versatile:
      "Usable in one or two hands; with two hands, a hit deals the damage shown in parentheses.",
    ammunition:
      "Needs ammunition; drawing a piece is part of the attack. You recover about half the ammunition spent after the fight.",
    loading:
      "Only one attack with this weapon per action, Bonus Action or reaction, even if you have several attacks.",
  },
});

// --- Mastery ("bottes d'arme") -----------------------------------------

export const WEAPON_MASTERIES = [
  "cleave",
  "graze",
  "nick",
  "push",
  "sap",
  "slow",
  "topple",
  "vex",
] as const;
export type WeaponMastery = (typeof WEAPON_MASTERIES)[number];
export const weaponMasterySchema = z.enum(WEAPON_MASTERIES);

export const WEAPON_MASTERY_LABELS: Record<WeaponMastery, string> = localized({
  fr: {
    cleave: "Enchaînement",
    graze: "Écorchure",
    nick: "Coup double",
    push: "Poussée",
    sap: "Sape",
    slow: "Ralentissement",
    topple: "Renversement",
    vex: "Ouverture",
  },
  en: {
    cleave: "Cleave",
    graze: "Graze",
    nick: "Nick",
    push: "Push",
    sap: "Sap",
    slow: "Slow",
    topple: "Topple",
    vex: "Vex",
  },
});

/** What each mastery does, in our own words (mechanics, not rulebook prose). */
export const WEAPON_MASTERY_DESCRIPTIONS: Record<WeaponMastery, string> = localized({
  fr: {
    cleave:
      "Si vous touchez une créature avec une attaque de corps à corps, infligez les dégâts de l'arme (sans modificateur) à une seconde créature à moins de 1,50 m de la première et à portée. Une fois par tour.",
    graze:
      "Si le jet d'attaque rate, la cible subit quand même des dégâts égaux au modificateur de caractéristique utilisé pour l'attaque, du type de l'arme. Aucun autre effet de l'arme ne s'applique.",
    nick: "L'attaque supplémentaire accordée par la propriété Légère se fait dans le cadre de l'action Attaque, sans coûter d'action Bonus. Une fois par tour.",
    push: "Si vous touchez une créature de taille G ou inférieure, vous pouvez la repousser de 3 m en ligne droite.",
    sap: "Si vous touchez, la cible a un désavantage à son prochain jet d'attaque avant le début de votre prochain tour.",
    slow: "Si vous touchez et infligez des dégâts, la Vitesse de la cible diminue de 3 m jusqu'au début de votre prochain tour.",
    topple:
      "Si vous touchez, la cible fait un jet de sauvegarde de Constitution (DD 8 + votre modificateur de caractéristique d'attaque + votre bonus de maîtrise) ou tombe à terre.",
    vex: "Si vous touchez et infligez des dégâts, vous avez un avantage à votre prochain jet d'attaque contre cette cible avant la fin de votre prochain tour.",
  },
  en: {
    cleave:
      "If you hit a creature with a melee attack, deal the weapon's damage (no modifier) to a second creature within 5 feet of the first and within reach. Once per turn.",
    graze:
      "If the attack roll misses, the target still takes damage equal to the ability modifier used for the attack, of the weapon's type. No other weapon effect applies.",
    nick: "The extra attack from the Light property is made as part of the Attack action, without costing a Bonus Action. Once per turn.",
    push: "If you hit a creature that is Large or smaller, you can push it 10 feet straight away from you.",
    sap: "If you hit, the target has disadvantage on its next attack roll before the start of your next turn.",
    slow: "If you hit and deal damage, the target's Speed drops by 10 feet until the start of your next turn.",
    topple:
      "If you hit, the target makes a Constitution saving throw (DC 8 + your attack ability modifier + your proficiency bonus) or falls prone.",
    vex: "If you hit and deal damage, you have advantage on your next attack roll against that target before the end of your next turn.",
  },
});

// --- Catalogue + stored shapes ---------------------------------------

export interface WeaponRange {
  /** Normal range in metres. */
  normal: number;
  /** Long range in metres. */
  max: number;
}

/** A catalogue entry (shape of every row in `weapons.json`). */
export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  /** Price in copper pieces. */
  priceCp: number;
  weightKg?: number;
  /** Damage dice (e.g. `1d8`; `1d1` for the blowgun). Absent on a `focus`. */
  damageDice?: DicePool;
  /** Absent on a `focus`. */
  damageType?: DamageType;
  properties: WeaponProperty[];
  /** Absent on a `focus` (and any weapon with no Mastery). */
  mastery?: WeaponMastery;
  /** Thrown / ammunition range, when the weapon has that property. */
  range?: WeaponRange;
  /** Two-handed damage dice for a Versatile weapon, e.g. `1d10`. */
  versatileDice?: DicePool;
}

/**
 * The subset of a {@link WeaponDef} stored on a character's weapon item. Carries
 * everything the rules engine needs so it never has to load the catalogue.
 * `damageDice` / `damageType` are absent on a `focus` (see `WEAPON_CATEGORIES`).
 */
export const weaponPropsSchema = z.object({
  category: weaponCategorySchema,
  damageDice: dicePoolSchema.optional(),
  damageType: damageTypeSchema.optional(),
  properties: z.array(weaponPropertySchema).max(12).default([]),
  mastery: weaponMasterySchema.optional(),
  range: z.object({ normal: z.number(), max: z.number() }).optional(),
  versatileDice: dicePoolSchema.optional(),
});
export type WeaponProps = z.infer<typeof weaponPropsSchema>;

/** A weapon you actually roll attacks with — not a `focus`, and it has a die. */
export function isAttackWeapon(props: Pick<WeaponProps, "category" | "damageDice">): boolean {
  return props.category !== "focus" && Boolean(props.damageDice);
}

/** Turn a catalogue entry into the stored props block. */
export function weaponPropsFromDef(def: WeaponDef): WeaponProps {
  return {
    category: def.category,
    damageDice: def.damageDice,
    damageType: def.damageType,
    properties: def.properties,
    mastery: def.mastery,
    range: def.range,
    versatileDice: def.versatileDice,
  };
}

/** Property list as display strings, e.g. `["Finesse", "Lancer (6/18)"]`. */
export function weaponPropertyLabels(
  props: Pick<WeaponProps, "properties" | "range" | "versatileDice">,
): string[] {
  return props.properties.map((property) => {
    if ((property === "thrown" || property === "ammunition") && props.range) {
      return `${WEAPON_PROPERTY_LABELS[property]} (${props.range.normal}/${props.range.max})`;
    }
    if (property === "versatile" && props.versatileDice) {
      const versatile = formatDicePool(props.versatileDice);
      if (versatile) return `${WEAPON_PROPERTY_LABELS[property]} (${versatile})`;
    }
    return WEAPON_PROPERTY_LABELS[property];
  });
}

// --- Proficiency + attack maths -------------------------------------

/**
 * What a class's weapon training covers. `martial`:
 * - `false` — simple weapons only
 * - `true` — all martial weapons
 * - `"finesse-or-light"` — martial weapons with Finesse or Light (Rogue)
 * - `"light"` — martial weapons with the Light property (Monk)
 */
export interface WeaponProficiencyGrant {
  simple: boolean;
  martial: false | true | "finesse-or-light" | "light";
}

export function isWeaponProficient(
  grant: WeaponProficiencyGrant,
  props: Pick<WeaponProps, "category" | "properties">,
): boolean {
  if (!isMartialCategory(props.category)) return grant.simple;
  if (grant.martial === true) return true;
  if (grant.martial === "finesse-or-light") {
    return props.properties.includes("finesse") || props.properties.includes("light");
  }
  if (grant.martial === "light") return props.properties.includes("light");
  return false;
}

/** Which ability an attack with this weapon uses. */
export function weaponAbility(
  props: Pick<WeaponProps, "category" | "properties">,
  mods: AbilityModifierBlock,
): Extract<Ability, "str" | "dex"> {
  if (isRangedCategory(props.category)) return "dex";
  if (props.properties.includes("finesse")) return mods.dex >= mods.str ? "dex" : "str";
  return "str";
}

/**
 * A **Monk weapon** (2024): any Simple Melee weapon, or a Martial Melee weapon
 * with the Light property. With Martial Arts these may use Dexterity and the
 * Martial Arts die.
 */
export function isMonkWeapon(props: Pick<WeaponProps, "category" | "properties">): boolean {
  if (props.category === "simple-melee") return true;
  if (props.category === "martial-melee") return props.properties.includes("light");
  return false;
}

export interface WeaponAttackContext {
  mods: AbilityModifierBlock;
  proficiencyBonus: number;
  proficient: boolean;
  masteryActive: boolean;
  /**
   * The Monk's Martial Arts die, when it applies to this weapon (a Monk weapon,
   * no armour or shield). The attack then uses Dexterity if it is the better
   * modifier, and the larger of the weapon die / this die.
   */
  martialArtsDie?: DicePool;
  /**
   * The Warlock's Pact weapon (Pacte de la lame): attacks and damage may use
   * Charisma instead of Strength / Dexterity — whichever is better.
   */
  pactCharisma?: boolean;
}

export interface WeaponAttack {
  ability: Extract<Ability, "str" | "dex" | "cha">;
  attackBonus: number;
  damageDice: string;
  damageBonus: number;
  damageType: DamageType;
  mastery: WeaponMastery | null;
  masteryActive: boolean;
  proficient: boolean;
}

/** Precondition: `isAttackWeapon(props)` — a `focus` has no attack. */
export function computeWeaponAttack(props: WeaponProps, ctx: WeaponAttackContext): WeaponAttack {
  const ma = ctx.martialArtsDie;
  let ability: Extract<Ability, "str" | "dex" | "cha"> = ma
    ? ctx.mods.dex >= ctx.mods.str
      ? "dex"
      : "str"
    : weaponAbility(props, ctx.mods);
  if (ctx.pactCharisma && ctx.mods.cha > ctx.mods[ability]) ability = "cha";
  const mod = ctx.mods[ability];
  const weaponPool = props.damageDice ?? { count: 1, die: "d1" };
  const pool = ma && DICE_SIDES[ma.die] > DICE_SIDES[weaponPool.die] ? ma : weaponPool;
  return {
    ability,
    attackBonus: mod + (ctx.proficient ? ctx.proficiencyBonus : 0),
    damageDice: formatDicePool(pool),
    damageBonus: mod,
    damageType: props.damageType ?? "bludgeoning",
    mastery: props.mastery ?? null,
    masteryActive: ctx.masteryActive,
    proficient: ctx.proficient,
  };
}
