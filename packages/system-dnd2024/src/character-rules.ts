import {
  ABILITIES,
  addBlocks,
  modifierBlock,
  proficiencyBonus,
  type Ability,
  type AbilityBonusBlock,
  type AbilityModifierBlock,
  type AbilityScoreBlock,
} from "./abilities";
import { resolveArmorClass, type ArmorProps } from "./armors";
import { backgroundFixedToolId, getBackground } from "./backgrounds";
import { choiceValue, type ChoicePick } from "./choices";
import { getClass, hasInvocations, martialArtsDie, weaponMasteryCount } from "./classes";
import { bonusActionOptions, combatNotes } from "./combat-notes";
import { formatDicePool } from "./dice";
import {
  featAbilityIncreases,
  featBonusActions,
  featCombatNotes,
  featEffects,
  getFeat,
  type FeatEffects,
} from "./feats";
import { collectMechanics } from "./feature-mechanics";
import {
  emptyMechanics,
  resolveMechanics,
  unarmoredDefenseBase,
  type ArmorState,
  type ResolvedAdvantage,
  type ResolvedDamageBonus,
} from "./mechanics";
import { grantedSpellsFor, type GrantedSpell } from "./granted-spells";
import {
  invocationCombatNotes,
  invocationEffects,
  validInvocations,
  type InvocationPick,
} from "./invocations";
import { choiceDerivedInput, mergeChoiceDerivedInput } from "./normalize-choices";
import {
  ASI_SCORE_CAP,
  abilityScoreImprovements,
  heldFeatIds,
  resolveChoices,
} from "./resolve-choices";
import { SKILLS, SKILL_ABILITY, type Skill, type SkillModifierBlock } from "./skills";
import {
  carryingCapacityKg,
  getSpecies,
  largerSize,
  getLineage,
  hasPowerfulBuild,
  speciesDarkvision,
  speciesHasSpells,
  speciesResistances,
  speciesSize,
  speciesSpellAbilitySchema,
  speciesSpeed,
  type CreatureSize,
} from "./species";
import type { DamageKind } from "./spells";
import { spellSlotsFor, spellcastingAbility } from "./spellcasting";
import { computeToolModifier, type ToolProps } from "./tools";
import {
  computeWeaponAttack,
  isAttackWeapon,
  isMonkWeapon,
  isRangedCategory,
  isWeaponProficient,
  type DamageType,
  type WeaponMastery,
  type WeaponProps,
} from "./weapons";
import { withContent } from "./packs/active";
import type { ContentOverlay } from "./packs/registry";
import { pick } from "./locale";

const DEFAULT_SPEED = 30;

/** Minimal shape of a stored weapon item the engine reads. */
export interface WeaponItemLike {
  id: string;
  name: string;
  /** The catalogue weapon it is — what a Weapon Mastery names. */
  catalogId?: string;
  weapon?: WeaponProps;
}

/** Minimal shape of a stored armour item the engine reads. */
export interface ArmorItemLike {
  id: string;
  name: string;
  armor?: ArmorProps & { equipped?: boolean };
}

/** Minimal shape of a stored tool item the engine reads. */
export interface ToolItemLike {
  id: string;
  name: string;
  catalogId?: string;
  tool?: ToolProps;
}

/** A species area attack resolved by a save (Dragonborn Breath Weapon). */
export interface DerivedSpeciesAttack {
  name: string;
  saveAbility: Extract<Ability, "dex">;
  saveDc: number;
  /** `"half"` — half damage on a successful save. */
  onSuccess: "half";
  damageDice: string;
  damageKind: DamageKind;
  shapes: string;
  /** Uses per long rest (= proficiency bonus). */
  usesPerLongRest: number;
}

/** Save DC / attack bonus of the species-granted spells. */
export interface DerivedSpeciesSpellcasting {
  ability: Ability;
  saveDc: number;
  attackBonus: number;
}

/** One computed weapon attack line on the derived block. */
export interface DerivedWeaponAttack {
  itemId: string;
  name: string;
  ability: Extract<Ability, "str" | "dex" | "cha">;
  attackBonus: number;
  damageDice: string;
  damageBonus: number;
  damageType: DamageType;
  proficient: boolean;
  mastery: WeaponMastery | null;
  masteryActive: boolean;
  /** The always-available Unarmed Strike line (`itemId: "unarmed-strike"`). */
  unarmed?: boolean;
  /** The Warlock's pact weapon: attacks with Charisme (Pacte de la lame). */
  pact?: boolean;
}

/** An effect the sheet folds into one of its numbers, and the number it changes. */
export interface IncludedEffect {
  on: "armorClass" | "initiative" | "hitPoints" | "attacks";
  /** « Vigilant +2 », « Archerie : +2 aux attaques à distance ». */
  text: string;
}

export interface CharacterDerived {
  /** Base scores + background bonuses. */
  adjustedAbilityScores: AbilityScoreBlock;
  abilityModifiers: AbilityModifierBlock;
  /** Max HP for the character's level (2024 class rules). */
  maxHitPoints: number;
  proficiencyBonus: number;
  /**
   * Armour Class from the equipped armour (10 + Dex when unarmoured). See
   * `resolveArmorClass`.
   */
  armorClass: number;
  /**
   * Walking speed in feet: the species base, −10 ft under heavy armour with too
   * little Strength, plus what the features add (Déplacement sans armure…).
   */
  speed: number;
  /** Climb / fly speeds in feet (Arpenteur, Monte-en-l'air); `0` = none. */
  climbSpeed: number;
  flySpeed: number;
  /** Dexterity + what the features add (Vigilant, Touche-à-tout). */
  initiativeBonus: number;
  /** Advantage on initiative (Instinct sauvage, Athlète accompli). */
  initiativeAdvantage: boolean;
  /** The saving throws the character is proficient in: the class's, then the features'. */
  proficientSaves: Ability[];
  /** Blindsight / tremorsense ranges in feet; `0` = none. */
  blindsight: number;
  tremorsense: number;
  /** Cantrips known beyond the class table (Ordre primitif : Magicien…). */
  bonusCantrips: number;
  /** Lowest natural d20 that scores a critical hit (Champion: 19, then 18). */
  critRange: number;
  /** Advantages the features grant, for the roll sheet (a `condition` only reminds). */
  advantages: ResolvedAdvantage[];
  /** Flat damage bonuses the roll sheet adds (Incantation puissante…). */
  damageBonuses: ResolvedDamageBonus[];
  /**
   * `false` when a piece of equipped armour is outside the character's training:
   * Disadvantage on Strength and Dexterity d20 tests, no spellcasting, and an
   * untrained shield adds nothing to the AC.
   */
  armorProficient: boolean;
  /** Worn armour that hampers Dexterity (Stealth) checks. */
  stealthDisadvantage: boolean;
  /** What the character carries without being slowed, in kilograms. */
  carryingCapacityKg: number;
  /** Weapon Mastery properties the character may use at its level (0 if none). */
  masterySlots: number;
  /** Class choices + background grants, de-duplicated. */
  proficientSkills: Skill[];
  skillModifiers: SkillModifierBlock;
  savingThrowModifiers: AbilityModifierBlock;
  passivePerception: number;
  /**
   * Every tool the character is **trained with** — class, background and the
   * player's own picks, de-duplicated and sorted. Owning the tool is a separate
   * matter: that is `tools` on the character.
   */
  toolProficiencies: string[];
  /** Check modifier per tool, keyed by catalogue id (or item id when unknown). */
  toolCheckModifiers: Record<string, number>;
  /** One line per catalogue-backed weapon carried. */
  weaponAttacks: DerivedWeaponAttack[];
  /**
   * The Unarmed Strike — always available to everyone (1 + Str bludgeoning, or
   * Grapple / Shove). A Monk's uses Dexterity if better and the Martial Arts die
   * while unarmoured and shieldless.
   */
  unarmedStrike: DerivedWeaponAttack;
  /** Martial Arts applies (Monk, no armour, no shield): the bonus-action Unarmed Strike. */
  martialArts: boolean;
  /** A save-based area attack from the species (Drakéide « Souffle »), or `null`. */
  speciesAttack: DerivedSpeciesAttack | null;
  /** Creature size: the species' own, or the one picked when it offers a choice. */
  size: CreatureSize;
  /** Darkvision range in feet (species, lineage, Vision du diable); `0` = none. */
  darkvision: number;
  /** Truesight range in feet (Vision sorcière); `0` = none. */
  truesight: number;
  /** Swim speed in feet (Présent des profondeurs: = walking speed); `0` = none. */
  swimSpeed: number;
  /** Damage types resisted through the species (Nain, Aasimar, Drakéide, Tieffelin…). */
  resistances: DamageKind[];
  /**
   * Numbers for the spells the species grants (elven lineage, fiendish legacy),
   * which use the ability the player picked rather than the class's. `null` when
   * the species grants no spells.
   */
  speciesSpellcasting: DerivedSpeciesSpellcasting | null;
  /**
   * Free-text reminders about automatic base-class features that change attack /
   * damage numbers (Rage, Attaque sournoise, Marque du chasseur, Châtiment).
   */
  combatNotes: string[];
  /**
   * What the sheet already counts in a number — never a reminder: a discreet
   * trace beside the number it changes (« Vigilant +2 » on the initiative).
   */
  includedEffects: IncludedEffect[];
  /** Combat options usable as a Bonus Action (base-class features + two-weapon fighting). */
  bonusActions: string[];
  /** The class's hit die (`d{hitDie}`), used for hit-dice recovery. */
  hitDie: number;
  /** Ability that powers spellcasting, or `null` for non-casters. */
  spellcastingAbility: Ability | null;
  /** 8 + proficiency + spellcasting modifier (`null` for non-casters). */
  spellSaveDc: number | null;
  /** proficiency + spellcasting modifier (`null` for non-casters). */
  spellAttackBonus: number | null;
  /** Max spell slots by spell level (1-9); `{}` for non-casters / Pact Magic. */
  spellSlots: Record<number, number>;
  /** Warlock Pact Magic (a few slots of one level, short-rest recovery), or `null`. */
  pactMagic: { count: number; level: number } | null;
  /**
   * Spells a class feature grants "always prepared" (Druide « Druidique »,
   * Rôdeur « Ennemi juré »…). They do not count against `preparedSpellsCount`
   * unless the entry says so. Empty for classes with no such grant.
   */
  grantedSpells: GrantedSpell[];
  /** Subclass picked, read back from `choices`; `null` below level 3. */
  subclassId: string | null;
  /**
   * Every feat held: the background's origin feat, the fighting style, and the
   * feats taken at a level slot. Read back from `choices`.
   */
  featIds: string[];
}

export interface ComputeCharacterInput {
  classId: string;
  level?: number;
  baseAbilityScores: AbilityScoreBlock;
  backgroundAbilityBonuses: AbilityBonusBlock;
  /** Needed for the two granted skill proficiencies. */
  backgroundId?: string;
  /** Needed for the base walking speed. */
  speciesId?: string;
  /** In-species choice (Drakéide ancestry → breath-weapon damage type, elven lineage, …). */
  speciesChoice?: string;
  /**
   * Size the player picked, for a species that offers a choice (Aasimar, Humain,
   * Tieffelin). Ignored when the species does not allow it.
   */
  size?: string;
  /**
   * Ability the species-granted spells are cast with (Int / Wis / Cha, the player's
   * pick). Defaults to the class's casting ability, else Charisma.
   */
  speciesSpellAbility?: string;
  /** Skill proficiencies picked from the class list. */
  skillProficiencies?: string[];
  /** Skill proficiencies picked from a species trait (Elf, Human). */
  speciesSkillProficiencies?: string[];
  /** Skills with expertise (proficiency counted twice). */
  skillExpertise?: string[];
  /**
   * The hit-die rolls kept for levels 2+, `{ level, roll }`. A level without
   * one gains the average (half the die + 1) — every sheet written before
   * rolls existed, and every player who keeps the average.
   */
  hitPointRolls?: readonly HitPointRoll[];
  /** Weapons carried (for the attack table + mastery). */
  weapons?: WeaponItemLike[];
  /** Armour carried; the `equipped` pieces drive AC / speed. */
  armors?: ArmorItemLike[];
  /** Tools carried (for the tool-check table). */
  tools?: ToolItemLike[];
  /** Tool proficiencies the player picked (catalogue ids). */
  toolProficiencies?: string[];
  /** Tools with expertise (catalogue ids). */
  toolExpertise?: string[];
  /** Weapon ids the player assigned a Mastery slot to. */
  weaponMasteries?: string[];
  /** Warlock « Manifestations occultes » picked (ids, or `{ id, spellId }`). */
  eldritchInvocations?: readonly (InvocationPick | string)[];
  /**
   * Resolved player choices. The engine reads the subclass and the feats back
   * from them; the dedicated fields above stay the source for everything else
   * until `normalizeChoices()` lands.
   */
  choices?: readonly ChoicePick[];
  /** Item id of the pact weapon (Pacte de la lame). */
  pactWeaponId?: string;
}

/**
 * Derive adjusted scores, modifiers, max HP and proficiency bonus from the
 * player-entered base scores + background allocation. Pure — used by the form
 * (live preview) and on write (denormalised persistence).
 *
 * Max HP (2024 PHB): level 1 = hit die max + CON modifier. Each further level
 * adds the die's average (round up) + CON modifier.
 */
/**
 * Folds `choices` into the dedicated fields so the rest of the function has a
 * single view. A sheet with no choices comes out untouched, which is what makes
 * this safe for everything written before the guided creation.
 */
function withResolvedChoices(input: ComputeCharacterInput): ComputeCharacterInput {
  if (!input.choices || input.choices.length === 0) return input;

  const defs = resolveChoices({
    classId: input.classId,
    speciesId: input.speciesId,
    backgroundId: input.backgroundId,
    level: input.level,
    picks: input.choices,
    invocations: input.eldritchInvocations,
  });
  const merged = mergeChoiceDerivedInput(input, choiceDerivedInput(defs, input.choices));

  return {
    ...input,
    skillProficiencies: merged.skillProficiencies,
    speciesSkillProficiencies: merged.speciesSkillProficiencies,
    toolProficiencies: merged.toolProficiencies,
    speciesChoice: merged.speciesChoice,
    size: merged.size,
    speciesSpellAbility: merged.speciesSpellAbility,
  };
}

export interface ComputeCharacterOptions {
  /**
   * Content packs to read species, backgrounds, subclasses and feats from, on
   * top of the SRD. Absent = whatever is active (`setActiveContent`); `null` =
   * the SRD alone.
   */
  content?: ContentOverlay | null;
}

export function computeCharacterDerived(
  rawInput: ComputeCharacterInput,
  options: ComputeCharacterOptions = {},
): CharacterDerived {
  return options.content === undefined
    ? deriveCharacter(rawInput)
    : withContent(options.content, () => deriveCharacter(rawInput));
}

/**
 * Adds the « Amélioration de caractéristique » points. An improvement never
 * takes a score past 20, but it never lowers one that is already above it.
 */
function withImprovements(
  scores: AbilityScoreBlock,
  improvements: Partial<Record<Ability, number>>,
): AbilityScoreBlock {
  const out = { ...scores };
  for (const ability of ABILITIES) {
    const points = improvements[ability] ?? 0;
    if (points > 0)
      out[ability] = Math.max(scores[ability], Math.min(ASI_SCORE_CAP, scores[ability] + points));
  }
  return out;
}

/** A hit-die roll kept for one level (2 to 20). */
/**
 * How a level beyond the first set its hit points: the average (no die), a
 * die rolled in the app, or one rolled at the table and typed in. Once
 * written, the choice is final.
 */
export type HitPointMethod = "average" | "roll" | "table";

export interface HitPointRoll {
  level: number;
  /** The die's face; absent for the average. */
  roll?: number;
  /** Absent on sheets saved before the choice was recorded (a roll was typed in). */
  method?: HitPointMethod;
}

/** The levels from 2 to `level` whose hit points have not been settled yet. */
export function unsettledHitPointLevels(
  rolls: readonly HitPointRoll[] | undefined,
  level: number,
): number[] {
  const settled = new Set((rolls ?? []).map((entry) => entry.level));
  const out: number[] = [];
  for (let at = 2; at <= level; at += 1) if (!settled.has(at)) out.push(at);
  return out;
}

/** What a hit die gives on average — half its faces, plus one. */
export function averageHitDie(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1;
}

/** The roll kept for `level`, if any. */
export function rollAt(
  rolls: readonly HitPointRoll[] | undefined,
  level: number,
): number | undefined {
  return rolls?.find((entry) => entry.level === level)?.roll;
}

/**
 * Hit points one level beyond the first adds: the roll (clamped to the die)
 * or the average, plus the Constitution modifier — never less than 1.
 */
export function hitPointGain(hitDie: number, conModifier: number, roll?: number): number {
  const die = roll === undefined ? averageHitDie(hitDie) : Math.min(hitDie, Math.max(1, roll));
  return Math.max(1, die + conModifier);
}

/** A feat's +1, each up to its own cap (20, or 30 for an epic boon). */
function withFeatIncreases(
  scores: AbilityScoreBlock,
  increases: readonly { ability: Ability; max: number }[],
): AbilityScoreBlock {
  const out = { ...scores };
  for (const { ability, max } of increases) {
    out[ability] = Math.max(out[ability], Math.min(max, out[ability] + 1));
  }
  return out;
}

function deriveCharacter(rawInput: ComputeCharacterInput): CharacterDerived {
  const input = withResolvedChoices(rawInput);
  const level = Math.max(1, input.level ?? 1);
  const klass = getClass(input.classId);
  const hitDie = klass?.hitDie ?? 8;
  const profBonus = proficiencyBonus(level);

  // Feats held, and what the engine folds in from them: their +1s here, then
  // Bagarreur de tavernes / Maître des armes lourdes in the attack table.
  const featIds = heldFeatIds({
    classId: input.classId,
    speciesId: input.speciesId,
    backgroundId: input.backgroundId,
    level,
    picks: input.choices,
    invocations: input.eldritchInvocations,
  });

  const scoresBeforeFeatures = withFeatIncreases(
    withImprovements(
      addBlocks(input.baseAbilityScores, input.backgroundAbilityBonuses),
      abilityScoreImprovements({ classId: input.classId, level, picks: input.choices }),
    ),
    featAbilityIncreases(featIds, input.choices),
  );

  // What the features, feats and class options change (see `mechanics.ts`):
  // the scores first (Champion primitif), then the rest with the new modifiers.
  const subclassId = choiceValue(input.choices, `class:${input.classId}:subclass`) ?? null;
  const mechanicList = collectMechanics({
    classId: input.classId,
    level,
    subclassId,
    speciesId: input.speciesId,
    featIds,
    picks: input.choices,
  });
  const adjustedAbilityScores = { ...scoresBeforeFeatures };
  for (const { ability, bonus, max } of resolveMechanics(mechanicList, {
    level,
    proficiencyBonus: profBonus,
    abilityModifiers: modifierBlock(scoresBeforeFeatures),
    armor: { bodyArmor: null, shield: false },
  }).abilityScores) {
    adjustedAbilityScores[ability] = Math.max(
      adjustedAbilityScores[ability],
      Math.min(max, adjustedAbilityScores[ability] + bonus),
    );
  }
  const abilityModifiers = modifierBlock(adjustedAbilityScores);

  // Worn armour decides some mechanics (Défense sans armure, Déplacement rapide).
  const worn = (input.armors ?? [])
    .map((item) => item.armor)
    .filter((armor): armor is ArmorProps & { equipped?: boolean } => Boolean(armor?.equipped));
  const armorState: ArmorState = {
    bodyArmor: worn.find((armor) => armor.category !== "shield") ?? null,
    shield: worn.some((armor) => armor.category === "shield"),
  };
  const mech = mechanicList.length
    ? resolveMechanics(mechanicList, {
        level,
        proficiencyBonus: profBonus,
        abilityModifiers,
        armor: armorState,
      })
    : emptyMechanics();
  const conModifier = abilityModifiers.con;

  let maxHitPoints = hitDie + conModifier;
  for (let at = 2; at <= level; at++) {
    maxHitPoints += hitPointGain(hitDie, conModifier, rollAt(input.hitPointRolls, at));
  }

  // --- Skill & saving-throw proficiencies -------------------------------
  const background = input.backgroundId ? getBackground(input.backgroundId) : undefined;
  const proficientSet = new Set<Skill>([
    ...(background?.skillProficiencies ?? []),
    ...((input.skillProficiencies ?? []) as Skill[]),
    ...((input.speciesSkillProficiencies ?? []) as Skill[]),
  ]);
  const expertiseSet = new Set<Skill>((input.skillExpertise ?? []) as Skill[]);

  const skillModifiers = Object.fromEntries(
    SKILLS.map((skill) => {
      const abilityMod = abilityModifiers[SKILL_ABILITY[skill]];
      const proficient = proficientSet.has(skill);
      const bonus =
        (proficient ? profBonus : 0) +
        (proficient && expertiseSet.has(skill) ? profBonus : 0) +
        (proficient ? 0 : mech.unproficientCheckBonus) +
        (mech.skillBonus[skill] ?? 0);
      return [skill, abilityMod + bonus];
    }),
  ) as SkillModifierBlock;

  const saveSet = new Set<Ability>([...(klass?.savingThrows ?? []), ...mech.saveProficiencies]);
  const savingThrowModifiers = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      abilityModifiers[ability] + (saveSet.has(ability) ? profBonus : 0) + mech.saveBonus[ability],
    ]),
  ) as AbilityModifierBlock;

  // --- Armour class & speed -------------------------------------------
  const featFx = featEffects(featIds);
  const armorTraining = new Set([
    ...(klass?.armorTraining ?? []),
    ...featFx.armorTraining,
    ...mech.armorTraining,
  ]);
  const wornPieces = worn;

  const armorProficient = wornPieces.every((armor) => armorTraining.has(armor.category));
  // A shield only helps a character trained with it.
  const equippedArmor = wornPieces.filter(
    (armor) => armor.category !== "shield" || armorTraining.has("shield"),
  );

  // Eldritch invocations, for a class that learns them — Armure d'ombres, Vision du diable…
  const invocations = hasInvocations(input.classId)
    ? validInvocations(input.eldritchInvocations ?? [], level)
    : [];
  const invocationFx = invocationEffects(invocations);
  // `body` is the worn armour, shields aside — the Défense style needs one.
  // Unarmoured, the best of: 10, Armure d'ombres (13), a feature's 10 + ability
  // (Défense sans armure, Résistance draconique). `resolveArmorClass` adds the Dex.
  const featureBase = unarmoredDefenseBase(
    mech.unarmoredDefense,
    abilityModifiers,
    equippedArmor.some((armor) => armor.category === "shield"),
  );
  const { armorClass, body: wornArmor } = resolveArmorClass(abilityModifiers.dex, equippedArmor, {
    unarmoredBase: Math.max(10, invocationFx.unarmoredAc ?? 0, featureBase ?? 0),
  });

  const species = getSpecies(input.speciesId ?? "");
  let speed = speciesSpeed(input.speciesId ?? "", input.speciesChoice) ?? DEFAULT_SPEED;
  const heavyEquipped = equippedArmor.find((armor) => armor.category === "heavy");
  if (heavyEquipped?.strengthMin && adjustedAbilityScores.str < heavyEquipped.strengthMin) {
    speed = Math.max(0, speed - 10);
  }
  speed += mech.speedBonus;
  const movementSpeed = (value: number | "speed") => (value === "speed" ? speed : value);
  const size = speciesSize(input.speciesId ?? "", input.size) ?? "medium";

  // --- Species attack (Drakéide « Souffle ») -----------------------
  let speciesAttack: DerivedSpeciesAttack | null = null;
  if (species?.breathWeapon) {
    const bw = species.breathWeapon;
    const dice = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
    speciesAttack = {
      name: bw.name,
      saveAbility: "dex",
      saveDc: 8 + profBonus + abilityModifiers.con,
      onSuccess: "half",
      damageDice: `${dice * bw.baseDice.count}${bw.baseDice.die}`,
      damageKind: getLineage(input.speciesId ?? "", input.speciesChoice)?.breathDamage ?? "fire",
      shapes: bw.shapes,
      usesPerLongRest: profBonus,
    };
  }

  // --- Weapon attacks, unarmed strike & mastery --------------------
  const masterySlots = weaponMasteryCount(input.classId, level);
  const chosenMasteries = new Set(input.weaponMasteries ?? []);
  // Gardien, Protecteur: every martial weapon on top of the class's grant.
  const weaponGrant =
    klass && mech.martialWeapons
      ? { ...klass.weaponProficiency, martial: true as const }
      : klass?.weaponProficiency;

  // Monk Martial Arts applies to Unarmed Strikes and Monk weapons while the
  // character wears no armour and holds no shield — every worn piece counts,
  // even a shield the Monk is not trained with (it adds nothing to the AC).
  const maDie = martialArtsDie(input.classId, level);
  const martialArts = maDie != null && wornPieces.length === 0;

  const unarmedAbility: Extract<Ability, "str" | "dex"> =
    martialArts && abilityModifiers.dex >= abilityModifiers.str ? "dex" : "str";
  const unarmedMod = abilityModifiers[unarmedAbility];
  const unarmedStrike: DerivedWeaponAttack = {
    itemId: "unarmed-strike",
    name: pick({ fr: "Coup à mains nues", en: "Unarmed Strike" }),
    ability: unarmedAbility,
    attackBonus: unarmedMod + profBonus,
    // Martial Arts wins over a feat die when it is larger; otherwise the feat
    // (Bagarreur de tavernes) replaces the flat 1.
    damageDice:
      martialArts && maDie
        ? formatDicePool(maDie)
        : featFx.unarmedDamageDice
          ? formatDicePool(featFx.unarmedDamageDice)
          : "1",
    damageBonus: unarmedMod,
    damageType: "bludgeoning",
    proficient: true,
    mastery: null,
    masteryActive: false,
    unarmed: true,
  };

  // The pact weapon (Pacte de la lame) must be a melee weapon the sheet carries.
  const pactWeapon = invocationFx.pactBlade
    ? (input.weapons ?? []).find(
        (item) =>
          item.id === input.pactWeaponId &&
          item.weapon != null &&
          isAttackWeapon(item.weapon) &&
          !isRangedCategory(item.weapon.category),
      )
    : undefined;

  const weaponAttacks: DerivedWeaponAttack[] = (input.weapons ?? [])
    .filter(
      (item): item is WeaponItemLike & { weapon: WeaponProps } =>
        item.weapon != null && isAttackWeapon(item.weapon),
    )
    .map((item) => {
      const isPact = item.id === pactWeapon?.id;
      const proficient =
        isPact || (weaponGrant ? isWeaponProficient(weaponGrant, item.weapon) : false);
      const masteryActive =
        Boolean(item.weapon.mastery) &&
        proficient &&
        masterySlots > 0 &&
        // A mastery names a kind of weapon; older sheets named the item itself.
        ((item.catalogId !== undefined && chosenMasteries.has(item.catalogId)) ||
          chosenMasteries.has(item.id));
      const attack = computeWeaponAttack(item.weapon, {
        mods: abilityModifiers,
        proficiencyBonus: profBonus,
        proficient,
        masteryActive,
        martialArtsDie: martialArts && isMonkWeapon(item.weapon) ? maDie : undefined,
        pactCharisma: isPact,
      });
      const ranged = isRangedCategory(item.weapon.category);
      const props = item.weapon.properties ?? [];
      // Cogneur lourd: the proficiency bonus is added to damage with a Heavy
      // weapon. Folded in here — the sheet cannot police "once per turn", and
      // the combat note says so.
      const heavyBonus =
        featFx.heavyWeaponProficiencyDamage && props.includes("heavy") ? profBonus : 0;
      // Archerie: +2 to hit with a ranged weapon.
      const archeryBonus = ranged ? featFx.rangedAttackBonus : 0;
      // Duel: +2 damage with a one-handed melee weapon. The rule also asks that
      // no other weapon be held, which is a loadout the sheet does not track —
      // the combat note carries that condition.
      const duelingBonus = !ranged && !props.includes("two-handed") ? featFx.duelingDamageBonus : 0;
      // Armes de lancer: +2 damage on a *ranged* hit with a Thrown weapon.
      const thrownBonus = props.includes("thrown") ? featFx.thrownDamageBonus : 0;
      // Six weapons are melee *and* Thrown (javelin, dagger, spear…), so both
      // styles can match the same line — but never the same attack: Duel is for
      // the thrust, Armes de lancer for the throw. The sheet shows one line per
      // weapon, so it takes the better of the two rather than adding them.
      const styleBonus = Math.max(duelingBonus, thrownBonus);
      return {
        itemId: item.id,
        name: item.name,
        ...attack,
        attackBonus: attack.attackBonus + archeryBonus,
        damageBonus: attack.damageBonus + heavyBonus + styleBonus,
        ...(isPact ? { pact: true } : {}),
      };
    });

  // --- Combat notes & bonus actions -------------------------------
  const lightMeleeWeapons = (input.weapons ?? []).filter(
    (item) =>
      item.weapon != null &&
      (item.weapon.category === "simple-melee" || item.weapon.category === "martial-melee") &&
      item.weapon.properties.includes("light"),
  ).length;
  const derivedCombatNotes = combatNotes(input.classId, level);
  const bonusActions = [
    ...bonusActionOptions({ classId: input.classId, level, lightMeleeWeapons }),
    ...featBonusActions(featIds),
  ];

  // --- Tool checks ---------------------------------------------------
  const toolProfSet = new Set<string>([
    ...(klass?.toolProficiencies ?? []),
    ...(input.toolProficiencies ?? []),
  ]);
  const backgroundToolId = background ? backgroundFixedToolId(background) : undefined;
  if (backgroundToolId) toolProfSet.add(backgroundToolId);
  const toolExpertSet = new Set(input.toolExpertise ?? []);

  const toolCheckModifiers: Record<string, number> = {};
  for (const item of input.tools ?? []) {
    if (!item.tool) continue;
    const key = item.catalogId ?? item.id;
    const proficient = item.catalogId ? toolProfSet.has(item.catalogId) : false;
    const expert = item.catalogId ? toolExpertSet.has(item.catalogId) : false;
    toolCheckModifiers[key] = computeToolModifier(
      item.tool.ability,
      abilityModifiers,
      profBonus,
      proficient,
      expert,
    );
  }

  // --- Spellcasting -------------------------------------------------
  const castAbility = spellcastingAbility(input.classId);
  const spellSaveDc = castAbility ? 8 + profBonus + abilityModifiers[castAbility] : null;
  const spellAttackBonus = castAbility ? profBonus + abilityModifiers[castAbility] : null;
  const { slots: spellSlots, pact: pactMagic } = spellSlotsFor(input.classId, level);
  const grantedSpells = grantedSpellsFor({
    classId: input.classId,
    level,
    speciesId: input.speciesId,
    speciesChoice: input.speciesChoice,
    invocations,
    picks: input.choices,
    featIds,
  });

  const invocationNotes = invocationCombatNotes({
    picks: invocations,
    level,
    chaMod: abilityModifiers.cha,
    pactSlotLevel: pactMagic?.level,
    hasPactWeapon: pactWeapon != null,
  });

  // --- Species spells (elven lineage, fiendish legacy) ------------------
  const speciesCastAbility: Ability | null =
    species && speciesHasSpells(species.id)
      ? (speciesSpellAbilitySchema.safeParse(input.speciesSpellAbility).data ??
        castAbility ??
        "cha")
      : null;
  const speciesSpellcasting: DerivedSpeciesSpellcasting | null = speciesCastAbility
    ? {
        ability: speciesCastAbility,
        saveDc: 8 + profBonus + abilityModifiers[speciesCastAbility],
        attackBonus: profBonus + abilityModifiers[speciesCastAbility],
      }
    : null;

  // --- What the numbers already include -----------------------------------
  const signedNumber = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
  const featsWith = (key: keyof FeatEffects) =>
    featIds.filter((id) => getFeat(id)?.effects?.[key]).map((id) => getFeat(id)!);
  const includedEffects: IncludedEffect[] = [
    ...mech.initiativeSources
      .filter(({ bonus }) => bonus !== 0)
      .map(({ source, bonus }) => ({
        on: "initiative" as const,
        text: `${source} ${signedNumber(bonus)}`,
      })),
    ...(wornArmor
      ? featsWith("armoredAcBonus").map((feat) => ({
          on: "armorClass" as const,
          text: `${feat.name} ${signedNumber(feat.effects!.armoredAcBonus!)}`,
        }))
      : []),
    ...(!wornArmor && invocationFx.unarmoredAc && invocationFx.unarmoredAc >= (featureBase ?? 0)
      ? [
          {
            on: "armorClass" as const,
            text: pick({
              fr: `Armure d'ombres : ${invocationFx.unarmoredAc} + Dex sans armure`,
              en: `Armor of Shadows: ${invocationFx.unarmoredAc} + Dex unarmored`,
            }),
          },
        ]
      : []),
    ...(!wornArmor && featureBase && featureBase > (invocationFx.unarmoredAc ?? 0)
      ? mech.unarmoredDefense.map(({ source }) => ({ on: "armorClass" as const, text: source }))
      : []),
    ...(species?.hitPointsPerLevel
      ? [
          {
            on: "hitPoints" as const,
            text: pick({
              fr: `${species.name} : +${species.hitPointsPerLevel} par niveau`,
              en: `${species.name}: +${species.hitPointsPerLevel} per level`,
            }),
          },
        ]
      : []),
    ...featsWith("hitPointsPerLevel").map((feat) => ({
      on: "hitPoints" as const,
      text: pick({
        fr: `${feat.name} : +${feat.effects!.hitPointsPerLevel} par niveau`,
        en: `${feat.name}: +${feat.effects!.hitPointsPerLevel} per level`,
      }),
    })),
    ...mech.hitPointSources.map(({ source, perLevel }) => ({
      on: "hitPoints" as const,
      text: pick({
        fr: `${source} : +${perLevel} par niveau`,
        en: `${source}: +${perLevel} per level`,
      }),
    })),
    ...featsWith("rangedAttackBonus").map((feat) => ({
      on: "attacks" as const,
      text: pick({
        fr: `${feat.name} : +${feat.effects!.rangedAttackBonus} aux attaques à distance`,
        en: `${feat.name}: +${feat.effects!.rangedAttackBonus} to ranged attacks`,
      }),
    })),
    ...featsWith("duelingDamageBonus").map((feat) => ({
      on: "attacks" as const,
      text: pick({
        fr: `${feat.name} : +${feat.effects!.duelingDamageBonus} aux dégâts d'une arme à une main`,
        en: `${feat.name}: +${feat.effects!.duelingDamageBonus} damage with a one-handed weapon`,
      }),
    })),
    ...featsWith("thrownDamageBonus").map((feat) => ({
      on: "attacks" as const,
      text: pick({
        fr: `${feat.name} : +${feat.effects!.thrownDamageBonus} aux dégâts d'une arme lancée`,
        en: `${feat.name}: +${feat.effects!.thrownDamageBonus} damage with a thrown weapon`,
      }),
    })),
    ...featsWith("heavyWeaponProficiencyDamage").map((feat) => ({
      on: "attacks" as const,
      text: pick({
        fr: `${feat.name} : bonus de maîtrise aux dégâts d'une arme lourde`,
        en: `${feat.name}: proficiency bonus to damage with a heavy weapon`,
      }),
    })),
    ...featsWith("unarmedDamageDice").map((feat) => ({
      on: "attacks" as const,
      text: pick({
        fr: `${feat.name} : ${formatDicePool(feat.effects!.unarmedDamageDice!)} à mains nues`,
        en: `${feat.name}: ${formatDicePool(feat.effects!.unarmedDamageDice!)} unarmed`,
      }),
    })),
    ...(pactWeapon
      ? [
          {
            on: "attacks" as const,
            text: pick({
              fr: "Arme de pacte : Charisme à l'attaque et aux dégâts",
              en: "Pact weapon: Charisma to attack and damage",
            }),
          },
        ]
      : []),
  ];
  return {
    adjustedAbilityScores,
    abilityModifiers,
    maxHitPoints: Math.max(
      1,
      maxHitPoints +
        (featFx.hitPointsPerLevel + (species?.hitPointsPerLevel ?? 0) + mech.hitPointsPerLevel) *
          level,
    ),
    proficiencyBonus: profBonus,
    armorClass: armorClass + (wornArmor ? featFx.armoredAcBonus : 0),
    speed,
    climbSpeed: movementSpeed(mech.movement.climb),
    flySpeed: movementSpeed(mech.movement.fly),
    // Initiative is a Dexterity check: Touche-à-tout counts, never a proficiency.
    initiativeBonus: abilityModifiers.dex + mech.initiativeBonus + mech.unproficientCheckBonus,
    initiativeAdvantage: mech.initiativeAdvantage,
    proficientSaves: ABILITIES.filter((ability) => saveSet.has(ability)),
    blindsight: mech.senses.blindsight ?? 0,
    tremorsense: mech.senses.tremorsense ?? 0,
    bonusCantrips: mech.extraCantrips,
    critRange: mech.critRange,
    advantages: mech.advantages,
    damageBonuses: mech.damageBonuses,
    armorProficient,
    masterySlots,
    proficientSkills: SKILLS.filter((skill) => proficientSet.has(skill)),
    skillModifiers,
    savingThrowModifiers,
    passivePerception: 10 + skillModifiers.perception,
    toolProficiencies: [...toolProfSet].sort(),
    toolCheckModifiers,
    weaponAttacks,
    unarmedStrike,
    martialArts,
    speciesAttack,
    size,
    carryingCapacityKg: carryingCapacityKg(
      adjustedAbilityScores.str,
      hasPowerfulBuild(input.speciesId) ? largerSize(size) : size,
    ),
    stealthDisadvantage: Boolean(wornArmor?.stealthDisadvantage),
    darkvision: Math.max(
      speciesDarkvision(input.speciesId ?? "", input.speciesChoice),
      invocationFx.darkvision,
      mech.senses.darkvision ?? 0,
    ),
    truesight: Math.max(invocationFx.truesight, mech.senses.truesight ?? 0),
    swimSpeed: Math.max(invocationFx.swimSpeed ? speed : 0, movementSpeed(mech.movement.swim)),
    resistances: [
      ...new Set([
        ...speciesResistances(input.speciesId ?? "", input.speciesChoice),
        ...mech.resistances,
      ]),
    ],
    speciesSpellcasting,
    combatNotes: [
      ...derivedCombatNotes,
      ...invocationNotes,
      ...featCombatNotes(featIds),
      ...mech.notes,
    ],
    includedEffects,
    bonusActions,
    hitDie,
    spellcastingAbility: castAbility,
    spellSaveDc,
    spellAttackBonus,
    spellSlots,
    pactMagic,
    grantedSpells,
    subclassId,
    featIds,
  };
}

/**
 * 2024 background bonus pattern: `+2` to one ability and `+1` to another, or
 * `+1` to three different abilities (total always `+3`).
 */
export function isValidBackgroundBonusPattern(bonus: AbilityBonusBlock): boolean {
  const positives = ABILITIES.map((ability) => bonus[ability])
    .filter((value) => value > 0)
    .sort((a, b) => b - a);
  const sum = positives.reduce((total, value) => total + value, 0);
  if (sum !== 3) return false;
  if (positives.length === 2) return positives[0] === 2 && positives[1] === 1;
  if (positives.length === 3) return positives.every((value) => value === 1);
  return false;
}

/**
 * Full check: valid pattern **and** every bonus placed on one of the
 * background's three allowed abilities.
 */
export function validateBackgroundBonuses(
  backgroundId: string,
  bonus: AbilityBonusBlock,
): { valid: boolean; reason?: string } {
  if (!isValidBackgroundBonusPattern(bonus)) {
    return {
      valid: false,
      reason: pick({
        fr: "Répartissez +2/+1 (ou +1/+1/+1) sur les caractéristiques de l'historique.",
        en: "Spread +2/+1 (or +1/+1/+1) over the background's abilities.",
      }),
    };
  }
  const background = getBackground(backgroundId);
  if (background) {
    for (const ability of ABILITIES) {
      if (bonus[ability] > 0 && !background.abilityOptions.includes(ability)) {
        return {
          valid: false,
          reason: pick({
            fr: "Un bonus est placé sur une caractéristique hors de l'historique choisi.",
            en: "A bonus sits on an ability outside the chosen background.",
          }),
        };
      }
    }
  }
  return { valid: true };
}
