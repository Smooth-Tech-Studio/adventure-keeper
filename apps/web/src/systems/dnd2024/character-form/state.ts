import {
  ZERO_MONEY,
  type Dnd2024Character,
  type Dnd2024CharacterDraft,
  type Dnd2024CharacterDraftInput,
  type Dnd2024CharacterInput,
  type Money,
  type Companion,
} from "@adventure-keeper/schemas";
import {
  ABILITIES,
  choiceDerivedInput,
  choiceValues,
  computeCharacterDerived,
  type CharacterDerived,
  getBackground,
  grantedLanguages,
  pruneChoicePicks,
  resolveChoices,
  getClass,
  getSpecies,
  invocationEffects,
  invocationsKnown,
  isAttackWeapon,
  isRangedCategory,
  isSpellcaster,
  normalizeInvocationPicks,
  speciesHasSizeChoice,
  speciesHasSpells,
  speciesSizes,
  validInvocations,
  validateBackgroundBonuses,
  skillExpertiseCount,
  weaponMasteryCount,
  type AbilityScoreBlock,
  type ChoicePick,
  type Alignment,
  type CreatureSize,
  type InvocationPick,
  type Skill,
  type SpeciesSpellAbility,
  type ContentPack,
  type HitPointRoll,
  hasInvocations,
} from "@adventure-keeper/system-dnd2024";

import {
  EMPTY_BONUSES,
  EMPTY_SCORES,
  type AbilityBonusDraft,
  type AbilityScoreDraft,
} from "@/systems/dnd2024/components/ability-scores";
import type { ImageUrlValue } from "@/components/image-url-field";
import { cleanItems, toItemDraft, type ItemDraft } from "@/systems/dnd2024/lib/items";
import { COINS, normalizeMoney } from "@/systems/dnd2024/lib/money";
import { tr } from "@/i18n";

export const LEVELS = Array.from({ length: 20 }, (_, index) => index + 1);

export interface FormState {
  name: string;
  /** An SRD `SpeciesId`, or `"pack:slug"` for a content-pack species. */
  speciesId: string;
  speciesChoice: string;
  /** Size picked when the species offers a choice (`""` = the default, Medium). */
  size: CreatureSize | "";
  /** Ability the species spells are cast with (`""` = default). */
  speciesSpellAbility: SpeciesSpellAbility | "";
  /** An SRD `ClassId`, or `"pack:slug"` for a content-pack class. */
  classId: string;
  /** An SRD `BackgroundId`, or `"pack:slug"` for a content-pack background. */
  backgroundId: string;
  alignment: Alignment | "";
  level: number;
  /** The sheet's copy of the pack entries it uses — kept as is when editing. */
  packContent: ContentPack[];
  /** `LanguageId`s, or `"pack:slug"` for a pack language. */
  languages: string[];
  cantrips: string[];
  spells: string[];
  /** Warlock « Manifestations occultes » (`spellId` = the cantrip it is attached to). */
  eldritchInvocations: InvocationPick[];
  /** Item id of the pact weapon (Pacte de la lame); `""` = none. */
  pactWeaponId: string;
  skillProficiencies: Skill[];
  speciesSkillProficiencies: Skill[];
  skillExpertise: Skill[];
  /** Hit-die rolls kept for levels 2+; a level without one gains the average. */
  hitPointRolls: HitPointRoll[];
  lore: string;
  base: AbilityScoreDraft;
  bonuses: AbilityBonusDraft;
  weapons: ItemDraft[];
  armors: ItemDraft[];
  tools: ItemDraft[];
  inventory: ItemDraft[];
  money: Money;
  /** Tool proficiencies the player picked (catalogue ids: class / background choices). */
  toolProficiencies: string[];
  /** Tools the character has expertise in (catalogue ids). */
  toolExpertise: string[];
  /** Weapon item ids assigned a Weapon Mastery slot. */
  weaponMasteries: string[];
  /** Not edited by the form: carried through so a save keeps them. */
  wildShapeForms: string[];
  companions: Companion[];
  /**
   * Resolved « pick N of these » choices. This form does not edit them yet —
   * the creation wizard does — so it only carries them through, which keeps an
   * edit from wiping what the wizard recorded.
   */
  choices: ChoicePick[];
  color?: string;
  image: ImageUrlValue;
}

export type SetForm = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

/**
 * Every problem {@link validateForm} can report.
 *
 * Each key MUST be registered in `ERROR_SECTION` (`./errors`), which is typed as
 * a *total* record over this union: adding a key here without saying which
 * section displays it is a compile error. That is deliberate — `toolProficiencies`
 * and `weaponMasteries` used to be produced by the validation and rendered
 * nowhere, so the form said "Corrigez les champs indiqués" with nothing marked.
 */
export type FormErrorKey =
  | "name"
  | "speciesId"
  | "speciesChoice"
  | "classId"
  | "backgroundId"
  | "alignment"
  | "base"
  | "bonuses"
  | "skills"
  | "speciesSkills"
  | "invocations"
  | "toolProficiencies"
  | "weaponMasteries";

/** Validation result: `{ field: message }`, empty when the sheet is valid. */
export type FormErrors = Partial<Record<FormErrorKey, string>>;

export function emptyState(): FormState {
  return {
    name: "",
    speciesId: "",
    speciesChoice: "",
    size: "",
    speciesSpellAbility: "",
    classId: "",
    backgroundId: "",
    alignment: "",
    level: 1,
    packContent: [],
    languages: [],
    cantrips: [],
    spells: [],
    eldritchInvocations: [],
    pactWeaponId: "",
    skillProficiencies: [],
    speciesSkillProficiencies: [],
    skillExpertise: [],
    hitPointRolls: [],
    lore: "",
    base: { ...EMPTY_SCORES },
    bonuses: { ...EMPTY_BONUSES },
    weapons: [],
    armors: [],
    tools: [],
    inventory: [],
    money: { ...ZERO_MONEY },
    toolProficiencies: [],
    toolExpertise: [],
    weaponMasteries: [],
    wildShapeForms: [],
    companions: [],
    choices: [],
    color: undefined,
    image: {},
  };
}

/**
 * Load a stored sheet into the form. Accepts a draft, where every player-entered
 * field may be missing — hence the fallbacks on what a finished sheet always has
 * (species, class, ability scores…).
 */
export function characterToState(character: Dnd2024Character | Dnd2024CharacterDraft): FormState {
  return {
    name: character.name ?? "",
    speciesId: character.speciesId ?? "",
    speciesChoice: character.speciesChoice ?? "",
    size: character.size ?? "",
    speciesSpellAbility: character.speciesSpellAbility ?? "",
    classId: character.classId ?? "",
    backgroundId: character.backgroundId ?? "",
    alignment: character.alignment ?? "",
    level: character.level ?? 1,
    packContent: character.packContent ?? [],
    languages: character.languages ?? [],
    cantrips: character.cantrips ?? [],
    spells: character.spells ?? [],
    eldritchInvocations: normalizeInvocationPicks(character.eldritchInvocations),
    pactWeaponId: character.pactWeaponId ?? "",
    skillProficiencies: character.skillProficiencies ?? [],
    speciesSkillProficiencies: character.speciesSkillProficiencies ?? [],
    skillExpertise: character.skillExpertise ?? [],
    hitPointRolls: character.hitPointRolls ?? [],
    lore: character.lore ?? "",
    base: toScoreDraft(character.baseAbilityScores),
    bonuses: { ...EMPTY_BONUSES, ...character.backgroundAbilityBonuses },
    weapons: (character.weapons ?? []).map(toItemDraft),
    armors: (character.armors ?? []).map(toItemDraft),
    tools: (character.tools ?? []).map(toItemDraft),
    inventory: (character.inventory ?? []).map(toItemDraft),
    toolProficiencies: character.toolProficiencies ?? [],
    toolExpertise: character.toolExpertise ?? [],
    weaponMasteries: masteryKinds(character.weapons ?? [], character.weaponMasteries ?? []),
    wildShapeForms: character.wildShapeForms ?? [],
    companions: character.companions ?? [],
    choices: character.choices ?? [],
    money: normalizeMoney(character.money),
    color: character.color,
    image: {
      imageUrl: character.imageUrl,
      imageCrop: character.imageCrop,
    },
  };
}

/** The choices open to this state — class, species, background, level and picks. */
export function stateChoiceDefs(state: FormState) {
  return resolveChoices({
    classId: state.classId || undefined,
    speciesId: state.speciesId || undefined,
    backgroundId: state.backgroundId || undefined,
    level: state.level,
    picks: state.choices,
    invocations: state.eldritchInvocations,
  });
}

/**
 * Drops the picks that no longer belong after a change of class, species,
 * background, level or of another pick — the chosen languages the species or
 * class now grants outright, and the Expertise and Weapon Mastery the class no
 * longer has room for (a Rogue turned Fighter keeps none).
 */
/** The rolls that still apply: one per level, from 2 to the current level. */
export function keptRolls(state: Pick<FormState, "level" | "hitPointRolls">): HitPointRoll[] {
  return state.hitPointRolls.filter((entry) => entry.level >= 2 && entry.level <= state.level);
}

export function withPrunedPicks(next: FormState): FormState {
  const granted = new Set(
    grantedLanguages({
      speciesId: next.speciesId || undefined,
      classId: next.classId || undefined,
    }).map((entry) => entry.id),
  );
  return {
    ...next,
    choices: pruneChoicePicks(stateChoiceDefs(next), next.choices, next.level),
    languages: next.languages.filter((id) => !granted.has(id)),
    hitPointRolls: keptRolls(next),
    skillExpertise: next.skillExpertise.slice(0, skillExpertiseCount(next.classId, next.level)),
    weaponMasteries: next.weaponMasteries.slice(0, weaponMasteryCount(next.classId, next.level)),
  };
}

/**
 * The picks are the source of truth, but the sheet also keeps dedicated fields
 * (skills, tools, lineage, size…) that the engine merges with them. Before a
 * save, those fields are rewritten from the picks, so a skill taken back stops
 * counting.
 */
export function withChoiceFields(state: FormState): FormState {
  const derived = choiceDerivedInput(stateChoiceDefs(state), state.choices);
  return {
    ...state,
    skillProficiencies: derived.skillProficiencies as FormState["skillProficiencies"],
    speciesSkillProficiencies:
      derived.speciesSkillProficiencies as FormState["speciesSkillProficiencies"],
    toolProficiencies: derived.toolProficiencies,
    speciesChoice: derived.speciesChoice ?? state.speciesChoice,
    // The size picked in the species step: without it the sheet fell back to
    // the species' first size (« Petite » for a Medium human).
    size: (derived.size as FormState["size"] | undefined) ?? state.size,
  };
}

/**
 * The derived block of a form state — what the sheet would show once saved.
 * `null` until the class and the six scores are known.
 */
export function deriveFormState(state: FormState): CharacterDerived | null {
  const block = scoreBlock(state.base);
  if (!block || !state.classId) return null;
  return computeCharacterDerived({
    classId: state.classId,
    level: state.level,
    baseAbilityScores: block,
    backgroundAbilityBonuses: state.bonuses,
    backgroundId: state.backgroundId || undefined,
    speciesId: state.speciesId || undefined,
    speciesChoice: state.speciesChoice || undefined,
    size: state.size || undefined,
    speciesSpellAbility: state.speciesSpellAbility || undefined,
    eldritchInvocations: state.eldritchInvocations,
    pactWeaponId: state.pactWeaponId || undefined,
    skillProficiencies: state.skillProficiencies,
    speciesSkillProficiencies: state.speciesSkillProficiencies,
    skillExpertise: state.skillExpertise,
    hitPointRolls: keptRolls(state),
    weapons: state.weapons,
    armors: state.armors,
    tools: state.tools,
    toolProficiencies: state.toolProficiencies,
    toolExpertise: state.toolExpertise,
    weaponMasteries: state.weaponMasteries,
    choices: state.choices,
  });
}

/**
 * Weapon masteries as kinds of weapon (catalogue ids). Older sheets named the
 * carried items: each is turned into its catalogue weapon, so saving the sheet
 * again moves it to the new shape.
 */
export function masteryKinds(
  weapons: readonly { id: string; catalogId?: string }[],
  ids: readonly string[],
): string[] {
  return [...new Set(ids.map((id) => weapons.find((weapon) => weapon.id === id)?.catalogId ?? id))];
}

/** The melee weapons of a weapon list — the only ones a pact weapon can be. */
export function meleeWeapons(weapons: ItemDraft[]): ItemDraft[] {
  return weapons.filter(
    (item) =>
      item.name.trim() !== "" &&
      item.weapon != null &&
      isAttackWeapon(item.weapon) &&
      !isRangedCategory(item.weapon.category),
  );
}

/**
 * The size to store: only for a species that lets the player pick, and only one
 * of its sizes. Otherwise the species (or the Medium default) decides on its own.
 */
function chosenSize(state: FormState): CreatureSize | undefined {
  if (!state.speciesId || !speciesHasSizeChoice(state.speciesId)) return undefined;
  return speciesSizes(state.speciesId).find((size) => size === state.size);
}

/** Whole, non-negative coin counts — what a purse may hold once saved. */
function cleanMoney(money: Money): Money {
  return Object.fromEntries(
    COINS.map(({ key }) => [key, Math.max(0, Math.round(money[key]) || 0)]),
  ) as Money;
}

/** The 6 base scores as a block, or `null` if any is missing / NaN. */
export function scoreBlock(base: AbilityScoreDraft): AbilityScoreBlock | null {
  const entries = ABILITIES.map((ability) => [ability, base[ability]] as const);
  if (entries.some(([, value]) => value === null || Number.isNaN(value))) return null;
  return Object.fromEntries(entries) as AbilityScoreBlock;
}

/**
 * Stored scores (possibly partial, on a draft) merged over an empty draft.
 * Written as a loop rather than a spread so an absent ability stays `null`
 * instead of becoming `undefined`.
 */
function toScoreDraft(stored: Partial<AbilityScoreBlock> | undefined): AbilityScoreDraft {
  const draft: AbilityScoreDraft = { ...EMPTY_SCORES };
  for (const ability of ABILITIES) {
    const value = stored?.[ability];
    if (typeof value === "number" && !Number.isNaN(value)) draft[ability] = value;
  }
  return draft;
}

/**
 * Just the abilities actually entered — a draft may hold three of six, and
 * dropping them because the block is incomplete is exactly the loss a draft is
 * supposed to prevent. `undefined` when nothing has been typed, so the field is
 * removed rather than stored empty.
 */
function filledScores(base: AbilityScoreDraft): Partial<AbilityScoreBlock> | undefined {
  const entries = ABILITIES.flatMap((ability) => {
    const value = base[ability];
    return typeof value === "number" && !Number.isNaN(value) ? [[ability, value] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Whether the class and background tool picks are all made.
 *
 * Checked choice by choice, as the wizard does: `toolProficiencies` also holds
 * the tools a feat grants (Musicien, Doué) and is de-duplicated, so its length
 * says nothing about these two picks. A sheet written before the choices
 * existed has none recorded; its field is then the only record, and is counted.
 */
function toolChoicesComplete(state: FormState, required: number): boolean {
  if (state.choices.length === 0) return state.toolProficiencies.length === required;
  return stateChoiceDefs(state)
    .filter((def) => def.kind === "tool" && (def.source === "class" || def.source === "background"))
    .every((def) => choiceValues(state.choices, def.id).length === def.count);
}

/** Field-level validation. Returns a `{ field: message }` map (empty = valid). */
export function validateForm(state: FormState): FormErrors {
  const next: FormErrors = {};
  const species = state.speciesId ? getSpecies(state.speciesId) : undefined;

  const t = (key: string, values?: Record<string, unknown>) =>
    tr(`characters:form.errors.${key}`, values);
  if (!state.name.trim()) next.name = t("name");
  if (!state.speciesId) next.speciesId = t("species");
  if (!state.classId) next.classId = t("class");
  if (!state.backgroundId) next.backgroundId = t("background");
  if (!state.alignment) next.alignment = t("alignment");
  if (species?.choice && !state.speciesChoice) {
    next.speciesChoice = t("speciesChoice", { label: species.choice.label });
  }

  const currentBlock = scoreBlock(state.base);
  if (!currentBlock) {
    next.base = t("base");
  } else if (ABILITIES.some((a) => currentBlock[a] < 1 || currentBlock[a] > 30)) {
    next.base = t("baseRange");
  }

  if (state.backgroundId) {
    const check = validateBackgroundBonuses(state.backgroundId, state.bonuses);
    if (!check.valid) next.bonuses = check.reason ?? t("bonuses");
  }

  if (state.classId && state.backgroundId) {
    const skillCount = getClass(state.classId)!.skillChoices.count;
    // `skillProficiencies` also holds skills a feat grants (Doué…): count the
    // class's own pick when the choices carry it, the field otherwise.
    const classPick = state.choices.find(
      (pick) => pick.choiceId === `class:${state.classId}:skills`,
    );
    const classSkills = classPick ? classPick.values.length : state.skillProficiencies.length;
    if (classSkills !== skillCount) {
      next.skills = t("skills", { count: skillCount });
    }
  }

  if (species?.skillGrant && state.speciesSkillProficiencies.length !== species.skillGrant.count) {
    next.speciesSkills = t("speciesSkills", {
      count: species.skillGrant.count,
      trait: species.skillGrant.trait,
    });
  }

  // Tool proficiency choices: one per background "au choix", plus the class's group.
  const klass = state.classId ? getClass(state.classId) : undefined;
  const background = state.backgroundId ? getBackground(state.backgroundId) : undefined;
  // A background asks for a tool either as a named family (« un instrument »)
  // or, on a custom one, with no grant at all — both are a pick.
  const backgroundTool = background?.toolProficiency;
  const backgroundToolChoices =
    background && (!backgroundTool || "choice" in backgroundTool) ? 1 : 0;
  const requiredToolChoices = (klass?.toolChoice?.count ?? 0) + backgroundToolChoices;
  if (requiredToolChoices > 0 && !toolChoicesComplete(state, requiredToolChoices)) {
    next.toolProficiencies = t("tools", { count: requiredToolChoices });
  }

  if (hasInvocations(state.classId)) {
    const known = invocationsKnown(state.classId, state.level);
    if (state.eldritchInvocations.length > known) {
      next.invocations = t("invocations", { count: known });
    }
  }

  if (state.classId) {
    const slots = weaponMasteryCount(state.classId, state.level);
    if (state.weaponMasteries.length > slots) {
      next.weaponMasteries = t("masteries", { count: slots });
    }
  }

  return next;
}

/**
 * Build a draft from whatever the form holds right now — no validation, no
 * derived block.
 *
 * Only what the player actually filled in is emitted: a field left untouched
 * stays `undefined` so it is removed from the document rather than stored as an
 * empty string. Ability scores are kept one by one (see {@link filledScores}) —
 * an incomplete block is the normal state of a draft, not a reason to drop it.
 */
export function formStateToDraftInput(state: FormState): Dnd2024CharacterDraftInput {
  const species = state.speciesId ? getSpecies(state.speciesId) : undefined;
  const caster = state.classId ? isSpellcaster(state.classId) : false;
  return {
    system: "dnd2024",
    name: state.name.trim(),
    speciesId: state.speciesId || undefined,
    speciesChoice: species?.choice ? state.speciesChoice.trim() || undefined : undefined,
    size: chosenSize(state),
    speciesSpellAbility:
      species && speciesHasSpells(species.id) ? state.speciesSpellAbility || undefined : undefined,
    classId: state.classId || undefined,
    backgroundId: state.backgroundId || undefined,
    alignment: state.alignment || undefined,
    lore: state.lore.trim() || undefined,
    level: state.level,
    packContent: state.packContent,
    languages: state.languages,
    cantrips: caster ? state.cantrips : [],
    spells: caster ? state.spells : [],
    eldritchInvocations: hasInvocations(state.classId) ? state.eldritchInvocations : [],
    pactWeaponId: state.pactWeaponId || undefined,
    skillProficiencies: state.skillProficiencies,
    speciesSkillProficiencies: state.speciesSkillProficiencies,
    skillExpertise: state.skillExpertise,
    hitPointRolls: keptRolls(state),
    baseAbilityScores: filledScores(state.base),
    backgroundAbilityBonuses: state.bonuses,
    weapons: cleanItems(state.weapons),
    armors: cleanItems(state.armors),
    tools: cleanItems(state.tools),
    inventory: cleanItems(state.inventory),
    toolProficiencies: state.toolProficiencies,
    toolExpertise: state.toolExpertise,
    weaponMasteries: state.weaponMasteries,
    choices: state.choices,
    money: cleanMoney(state.money),
    color: state.color || undefined,
    imageUrl: state.image.imageUrl,
    imageCrop: state.image.imageCrop,
  };
}

/** Build the persisted input from a validated form state. */
export function formStateToInput(state: FormState): Dnd2024CharacterInput {
  const species = state.speciesId ? getSpecies(state.speciesId) : undefined;
  const currentBlock = scoreBlock(state.base)!;

  // Warlock invocations: keep the ones that still hold, and the pact weapon only
  // while Pacte de la lame is picked and the weapon is a melee one we carry.
  const invocations = hasInvocations(state.classId)
    ? validInvocations(state.eldritchInvocations, state.level, state.cantrips)
    : [];
  const pactWeaponId = invocationEffects(invocations).pactBlade
    ? meleeWeapons(state.weapons).find((weapon) => weapon.id === state.pactWeaponId)?.id
    : undefined;

  return {
    // This form only produces 5e 2024 sheets; the standard form is separate.
    system: "dnd2024",
    name: state.name.trim(),
    speciesId: state.speciesId,
    speciesChoice: species?.choice ? state.speciesChoice.trim() || undefined : undefined,
    size: chosenSize(state),
    speciesSpellAbility:
      species && speciesHasSpells(species.id) ? state.speciesSpellAbility || undefined : undefined,
    classId: state.classId as Dnd2024CharacterInput["classId"],
    backgroundId: state.backgroundId,
    alignment: state.alignment as Alignment,
    lore: state.lore.trim() || undefined,
    level: state.level,
    packContent: state.packContent,
    languages: state.languages,
    cantrips: isSpellcaster(state.classId) ? state.cantrips : [],
    spells: isSpellcaster(state.classId) ? state.spells : [],
    eldritchInvocations: invocations,
    pactWeaponId,
    skillProficiencies: state.skillProficiencies,
    speciesSkillProficiencies: state.speciesSkillProficiencies,
    skillExpertise: state.skillExpertise,
    hitPointRolls: keptRolls(state),
    baseAbilityScores: currentBlock,
    backgroundAbilityBonuses: state.bonuses,
    weapons: cleanItems(state.weapons),
    armors: cleanItems(state.armors),
    tools: cleanItems(state.tools),
    inventory: cleanItems(state.inventory),
    toolProficiencies: state.toolProficiencies,
    toolExpertise: state.toolExpertise,
    weaponMasteries: state.weaponMasteries,
    choices: state.choices,
    wildShapeForms: state.wildShapeForms,
    companions: state.companions,
    money: cleanMoney(state.money),
    color: state.color || undefined,
    imageUrl: state.image.imageUrl,
    imageCrop: state.image.imageCrop,
  };
}
