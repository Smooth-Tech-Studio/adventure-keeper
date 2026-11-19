import {
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_LABELS,
  ALIGNMENT_LABELS,
  ABILITY_METHOD_LABELS,
  STANDARD_ARRAY,
  bonusCantripsFor,
  classLanguagePicks,
  cantripsKnown,
  evaluatePointBuy,
  equipmentOwnerOf,
  getFeat,
  grantedLanguages,
  startingEquipmentById,
  isSpellcaster,
  preparedSpellsCount,
  skillExpertiseCount,
  unsettledHitPointLevels,
  weaponMasteryCount,
  type AbilityMethod,
  type BackgroundDef,
  type ChoiceDef,
  type ClassDef,
  type SpeciesDef,
  hasWildShape,
  knownWildShapeForms,
  wildShapeFormsDue,
} from "@adventure-keeper/system-dnd2024";

import { EMPTY_SCORES } from "@/systems/dnd2024/components/ability-scores";
import type { FormState } from "@/systems/dnd2024/character-form/state";
import type { CreationStepDef } from "@/systems/dnd2024/creation-wizard/steps";
import i18n, { tr } from "@/i18n";

/**
 * The guided creation, one question per screen.
 *
 * Each of the five steps is cut into **sub-steps** here. Most of them come from
 * the rules data — one per `ChoiceDef` group that `resolveChoices()` opened for
 * the step — so a new choice in the data still shows up by itself, now as its
 * own screen. The rest are the handful of fixed questions every character
 * answers (name, alignment, ability scores, shopping).
 *
 * Everything in this module is pure: the wizard renders what it returns, and
 * the tests hold the order and the validation.
 */

export type SubstepKind =
  /** The class / species / background carousel. */
  | "pick"
  /** Name and starting level. */
  | "identity"
  /** One group of rules choices (a `ChoiceDef` and, for a feat, its siblings). */
  | "choices"
  /** Read-only: what the class does up to the chosen level. */
  | "classFeatures"
  /** The class's cantrips and prepared spells, as hands of cards. */
  | "spells"
  /** The carried weapons whose mastery property the class uses. */
  | "masteries"
  /** Druid: the beasts known for Wild Shape. */
  | "wildShape"
  /** Proficient skills whose proficiency bonus counts double. */
  | "expertise"
  /** Rebuild only: what a new species, class or background removes and brings. */
  | "impact"
  /** Read-only: the species traits. */
  | "speciesTraits"
  | "alignment"
  | "languages"
  | "lore"
  | "method"
  | "values"
  | "bonus"
  /** Average or rolled hit points, for each level beyond the first. */
  | "hitPoints"
  /** Read-only: the numbers that follow from the scores. */
  | "recap"
  | "kit"
  | "shop"
  | "review";

export interface Substep {
  /** Stable within its step — what a « Modifier » link targets. */
  key: string;
  kind: SubstepKind;
  /** Short label for the rail. */
  nav: string;
  /** The question, as the screen's heading. */
  title: string;
  /** One line under the heading. */
  lead?: string;
  /** The question the help answers (« À quoi sert une compétence ? »). */
  whyTitle?: string;
  /** The help itself — our words. */
  why?: string;
  /** For `choices`: the defs rendered on this screen. */
  defs?: ChoiceDef[];
  /** May be left empty: the button reads « Passer ». */
  optional?: boolean;
  /** Uses the full width — no help column. */
  wide?: boolean;
}

export interface SubstepContext {
  state: FormState;
  /** The defs `resolveChoices()` routes to this step (`choiceStep()`). */
  stepDefs: ChoiceDef[];
  klass?: ClassDef;
  species?: SpeciesDef;
  background?: BackgroundDef;
}

/** Languages the origin lets the player add on top of the ones the species and class grant. */
export const LANGUAGES_TO_PICK = 2;

/** Languages to add: the origin's, plus any a class feature brings (the rogue's). */
export function languagesToPick(state: Pick<FormState, "classId">): number {
  return LANGUAGES_TO_PICK + classLanguagePicks(state.classId);
}

// --- Grouping ----------------------------------------------------------------

/**
 * One screen per choice, except a feat's own picks, which stay together: the
 * three parts of « Initié à la magie » are one decision. So do a level's feat
 * and the abilities « Amélioration de caractéristique » raises. Equipment goes
 * last — you choose what to carry once you know what you can do.
 */
export function groupChoiceDefs(defs: readonly ChoiceDef[]): { key: string; defs: ChoiceDef[] }[] {
  // A choice a starting package opens (« Jeu emporté ») only exists once the
  // package is picked: on a screen of its own it would appear *behind* the
  // player. It joins the package's screen instead, right under it.
  const kitChoiceOwner = new Map<string, string>();
  for (const def of defs) {
    const owner = equipmentOwnerOf(def.id);
    if (!owner) continue;
    for (const option of startingEquipmentById(owner)?.options ?? []) {
      for (const choice of option.choices ?? []) kitChoiceOwner.set(choice.id, def.id);
    }
  }

  const groups: { key: string; match: string; defs: ChoiceDef[] }[] = [];
  for (const def of defs) {
    const together = def.source === "feat" || def.source === "level";
    const match =
      kitChoiceOwner.get(def.id) ?? (together ? def.id.split(":").slice(0, 2).join(":") : def.id);
    const group = groups.find((existing) => existing.match === match);
    if (group) group.defs.push(def);
    else groups.push({ key: def.source === "feat" ? match : def.id, match, defs: [def] });
  }
  const isEquipment = (group: { key: string }) => (group.key.endsWith(":equipment") ? 1 : 0);
  return groups
    .sort((a, b) => isEquipment(a) - isEquipment(b))
    .map(({ key, defs: members }) => ({ key, defs: members }));
}

// --- Copy --------------------------------------------------------------------
//
// The texts live in the `wizard` translations, under `substeps.<key>`.

type SubstepCopy = Omit<Substep, "key" | "kind" | "defs">;

/** One field of a sub-step's copy, `undefined` when the translations have none. */
function copyText(key: string, field: string, values?: Record<string, unknown>) {
  const id = `wizard:substeps.${key}.${field}`;
  // `values` carries `count`, which plural keys (`title_one`) need to resolve.
  return i18n.exists(id, values) ? tr(id, values) : undefined;
}

/**
 * A sub-step whose texts are read when accessed: the constants below follow
 * the interface language without being rebuilt.
 */
function fixedSubstep(
  key: string,
  kind: SubstepKind,
  extra: Partial<Substep> = {},
  textKey = key,
): Substep {
  return {
    key,
    kind,
    ...extra,
    get nav() {
      return copyText(textKey, "nav") ?? "";
    },
    get title() {
      return copyText(textKey, "title") ?? "";
    },
    get lead() {
      return copyText(textKey, "lead");
    },
    get whyTitle() {
      return copyText(textKey, "whyTitle");
    },
    get why() {
      return copyText(textKey, "why");
    },
  };
}

function choiceCopy(defs: ChoiceDef[]): SubstepCopy {
  const def = defs[0];
  const slug = def.id.split(":").pop() ?? "";

  if (def.source === "feat") {
    const feat = getFeat(def.id.split(":")[1]);
    return {
      nav: feat ? tr("wizard:substeps.feat.nav", { name: feat.name }) : def.label,
      title: feat ? tr("wizard:substeps.feat.title", { name: feat.name }) : def.label,
      lead: feat?.summary,
      whyTitle: tr("wizard:substeps.feat.whyTitle"),
      why: tr("wizard:substeps.feat.why"),
    };
  }
  if (def.source === "level") {
    const level = def.id.split(":")[1];
    const epic = slug === "epic-boon";
    return {
      nav: tr("wizard:substeps.level.nav", { level }),
      title: def.label,
      lead: def.hint,
      whyTitle: tr(
        epic ? "wizard:substeps.level.epicWhyTitle" : "wizard:substeps.level.asiWhyTitle",
      ),
      why: tr(epic ? "wizard:substeps.level.epicWhy" : "wizard:substeps.level.asiWhy"),
    };
  }

  const texts = (key: string, overrides: Partial<SubstepCopy> = {}): SubstepCopy => ({
    nav: copyText(key, "nav") ?? def.label,
    title: copyText(key, "title", { label: def.label, count: def.count }) ?? def.label,
    whyTitle: copyText(key, "whyTitle"),
    why: copyText(key, "why"),
    ...overrides,
  });
  const copy: Record<string, () => SubstepCopy> = {
    skills: () => texts("skills"),
    tool: () => texts("tool"),
    "fighting-style": () => texts("fighting-style"),
    subclass: () => texts("subclass", { nav: def.label }),
    equipment: () => texts("equipment"),
    lineage: () => texts("lineage", { nav: def.label }),
    size: () => texts("size"),
    skill: () => texts("skill", { nav: def.label }),
    "spell-ability": () => texts("spell-ability"),
    "origin-feat": () => texts("origin-feat"),
    "skill-swap": () => texts("skill-swap"),
  };
  return {
    lead: def.hint,
    ...(copy[slug]?.() ?? { nav: def.label, title: def.label, why: def.hint }),
  };
}

// --- Building ----------------------------------------------------------------

/** One sub-step per group of choices, with its copy — shared with the level-up. */
export function choiceSubsteps(defs: readonly ChoiceDef[]): Substep[] {
  return groupChoiceDefs(defs).map((group) => ({
    key: group.key,
    kind: "choices" as const,
    defs: group.defs,
    ...choiceCopy(group.defs),
  }));
}

/** The class spells screen — the same in the creation and the level-up. */
export const SPELLS_SUBSTEP: Substep = fixedSubstep("spells", "spells");

/** Weapon Mastery — after the class's equipment, whose weapons head the list. */
export const MASTERIES_SUBSTEP: Substep = fixedSubstep("masteries", "masteries");

/** The druid's Wild Shape forms — the same in the creation and the level-up. */
export const WILD_SHAPE_SUBSTEP: Substep = fixedSubstep("wildShape", "wildShape");

/** What a druid's sheet lacks in Wild Shape forms: as many as the level allows. */
export function wildShapeIssues(state: Pick<FormState, "classId" | "level" | "wildShapeForms">) {
  if (!hasWildShape(state.classId, state.level)) return [];
  const count = wildShapeFormsDue(state.level);
  const picked = knownWildShapeForms(state.wildShapeForms, state.level).length;
  return picked === count ? [] : [tr("wizard:issues.wildShape", { picked, count })];
}

/** Expertise — right after the class's skills, the pool it mostly draws from. */
export const EXPERTISE_SUBSTEP: Substep = fixedSubstep("expertise", "expertise");

/** `true` when the class uses Weapon Mastery at this level. */
export function hasMasteries(state: Pick<FormState, "classId" | "level">): boolean {
  return Boolean(state.classId) && weaponMasteryCount(state.classId, state.level) > 0;
}

/** `true` when the class grants Expertise at this level. */
export function hasExpertise(state: Pick<FormState, "classId" | "level">): boolean {
  return Boolean(state.classId) && skillExpertiseCount(state.classId, state.level) > 0;
}

/** Hit points per level — the creation (levels 2+) and the level-up. */
export const HIT_POINTS_SUBSTEP: Substep = fixedSubstep("hit-points", "hitPoints");

/** Shown right after a new species, class or background on a finished sheet. */
export const IMPACT_SUBSTEP: Substep = fixedSubstep("impact", "impact");

/** « l'espèce », "the species" — the entity a step picks, for its messages. */
const pickNoun = (entity: string) => tr(`wizard:substeps.pick.${entity}.noun`);

/** The sub-steps of one step, in order. */
export function buildSubsteps(step: CreationStepDef, ctx: SubstepContext): Substep[] {
  const { state, klass, background } = ctx;
  const out: Substep[] = [];

  if (step.entity) {
    out.push({
      key: "pick",
      kind: "pick",
      nav: step.label,
      title: tr(`wizard:substeps.pick.${step.entity}.title`),
      lead: step.description,
      wide: true,
    });
    // Nothing else exists before the entity is picked: the rail says so.
    if (!entityIdOf(step.entity, state)) return out;
  }

  switch (step.id) {
    case "class":
      out.push(fixedSubstep("identity", "identity"));
      out.push(...withExpertise(state, choiceSubsteps(ctx.stepDefs)));
      if (hasMasteries(state)) out.push(MASTERIES_SUBSTEP);
      if (hasClassSpells(state)) out.push(SPELLS_SUBSTEP);
      if (hasWildShape(state.classId, state.level)) out.push(WILD_SHAPE_SUBSTEP);
      out.push({
        key: "features",
        kind: "classFeatures",
        nav: tr("wizard:substeps.features.nav"),
        title: tr("wizard:substeps.features.title", {
          class: klass?.name.toLowerCase() ?? tr("wizard:substeps.features.fallback"),
        }),
        lead: tr("wizard:substeps.features.lead", { level: state.level }),
        whyTitle: tr("wizard:substeps.features.whyTitle"),
        why: tr("wizard:substeps.features.why"),
      });
      break;

    case "species":
      out.push(...choiceSubsteps(ctx.stepDefs));
      out.push(fixedSubstep("traits", "speciesTraits"));
      break;

    case "background":
      out.push(...choiceSubsteps(ctx.stepDefs));
      out.push(
        fixedSubstep("alignment", "alignment"),
        {
          key: "languages",
          kind: "languages",
          nav: tr("wizard:substeps.languages.nav"),
          title: tr("wizard:substeps.languages.title"),
          lead: tr("wizard:substeps.languages.lead", { count: languagesToPick(state) }),
          whyTitle: tr("wizard:substeps.languages.whyTitle"),
          why: tr("wizard:substeps.languages.why"),
        },
        {
          key: "lore",
          kind: "lore",
          nav: tr("wizard:substeps.lore.nav"),
          title: tr("wizard:substeps.lore.title"),
          lead: tr("wizard:substeps.lore.lead"),
          whyTitle: tr("wizard:substeps.lore.whyTitle"),
          why: tr("wizard:substeps.lore.why", {
            background: background?.name.toLowerCase() ?? tr("wizard:substeps.lore.fallback"),
          }),
          optional: true,
        },
      );
      break;

    case "abilities":
      out.push(
        fixedSubstep("method", "method"),
        {
          key: "values",
          kind: "values",
          nav: tr("wizard:substeps.values.nav"),
          title: tr("wizard:substeps.values.title"),
          lead: klass
            ? tr("wizard:substeps.values.lead", {
                abilities: klass.primaryAbility
                  .map((ability) => ABILITY_LABELS[ability])
                  .join(tr("wizard:substeps.values.and")),
              })
            : undefined,
          whyTitle: tr("wizard:substeps.values.whyTitle"),
          why: tr("wizard:substeps.values.why"),
        },
        {
          key: "bonus",
          kind: "bonus",
          nav: tr("wizard:substeps.bonus.nav"),
          title: tr("wizard:substeps.bonus.title"),
          lead: background
            ? tr("wizard:substeps.bonus.lead", {
                background: background.name,
                abilities: background.abilityOptions
                  .map((ability) => ABILITY_LABELS[ability])
                  .join(", "),
              })
            : undefined,
          whyTitle: tr("wizard:substeps.bonus.whyTitle"),
          why: tr("wizard:substeps.bonus.why"),
        },
      );
      if (state.level > 1) out.push(HIT_POINTS_SUBSTEP);
      out.push(...choiceSubsteps(ctx.stepDefs));
      out.push(fixedSubstep("recap", "recap"));
      break;

    case "shop":
      out.push(
        fixedSubstep("kit", "kit"),
        fixedSubstep("shop", "shop", { optional: true }),
        fixedSubstep("review", "review", { wide: true }),
      );
      break;
  }
  return out;
}

/** The class's choices, with Expertise right after its skills when the class grants it. */
function withExpertise(state: FormState, subs: Substep[]): Substep[] {
  if (!hasExpertise(state)) return subs;
  const at = subs.findIndex((sub) => sub.key.endsWith(":skills")) + 1;
  return [...subs.slice(0, at), EXPERTISE_SUBSTEP, ...subs.slice(at)];
}

/** Label of the placeholder the rail shows before the entity is picked. */
export function pendingLabel(step: CreationStepDef): string | undefined {
  return step.entity
    ? tr("wizard:substeps.pick.pending", { noun: pickNoun(step.entity) })
    : undefined;
}

export function entityIdOf(
  entity: NonNullable<CreationStepDef["entity"]>,
  state: FormState,
): string {
  if (entity === "class") return state.classId;
  if (entity === "species") return state.speciesId;
  return state.backgroundId;
}

// --- Validation --------------------------------------------------------------

export interface IssueContext {
  state: FormState;
  /** `validateChoices()` messages, keyed by choice id. */
  choiceErrors: Record<string, string>;
  /** `validateBackgroundBonuses()`, already run. */
  bonusError?: string;
  /** Point-buy over budget, or a score out of range. */
  pointBuyError?: string;
  /** Skills the character is proficient in — what Expertise may pick from. */
  proficientSkills?: readonly string[];
}

export interface SubstepIssue {
  message: string;
  /** Set when the message belongs under a choice field. */
  choiceId?: string;
}

/** Player-picked languages, minus any the species or class already grant. */
export function chosenLanguages(state: FormState): FormState["languages"] {
  const granted = new Set(
    grantedLanguages({
      speciesId: state.speciesId || undefined,
      classId: state.classId || undefined,
    }).map((entry) => entry.id),
  );
  return state.languages.filter((id) => !granted.has(id));
}

/** What still blocks this sub-step; empty when the player may move on. */
export function substepIssues(
  sub: Substep,
  step: CreationStepDef,
  ctx: IssueContext,
): SubstepIssue[] {
  const { state } = ctx;
  switch (sub.kind) {
    case "pick":
      return step.entity && !entityIdOf(step.entity, state)
        ? [{ message: tr("wizard:issues.pick", { noun: pickNoun(step.entity) }) }]
        : [];
    case "identity":
      return state.name.trim() ? [] : [{ message: tr("wizard:issues.name") }];
    case "choices":
      return (sub.defs ?? [])
        .filter((def) => ctx.choiceErrors[def.id])
        .map((def) => ({ message: ctx.choiceErrors[def.id], choiceId: def.id }));
    case "spells":
      return spellIssues(state).map((message) => ({ message }));
    case "masteries":
      return masteryIssues(state).map((message) => ({ message }));
    case "wildShape":
      return wildShapeIssues(state).map((message) => ({ message }));
    case "expertise":
      return expertiseIssues(state, ctx.proficientSkills).map((message) => ({ message }));
    case "alignment":
      return state.alignment ? [] : [{ message: tr("wizard:issues.alignment") }];
    case "languages": {
      const count = chosenLanguages(state).length;
      const toPick = languagesToPick(state);
      return count === toPick
        ? []
        : [{ message: tr("wizard:issues.languages", { count: toPick, picked: count }) }];
    }
    case "values": {
      const issues: SubstepIssue[] = [];
      if (Object.values(state.base).some((value) => value === null)) {
        issues.push({ message: tr("wizard:issues.values") });
      }
      if (ctx.pointBuyError) issues.push({ message: ctx.pointBuyError });
      return issues;
    }
    case "bonus":
      return ctx.bonusError ? [{ message: ctx.bonusError }] : [];
    case "hitPoints":
      return hitPointIssues(state).map((message) => ({ message }));
    default:
      return [];
  }
}

/** Each level beyond the first waits for its hit points to be settled — a final choice. */
export function hitPointIssues(state: Pick<FormState, "level" | "hitPointRolls">): string[] {
  const left = unsettledHitPointLevels(state.hitPointRolls, state.level);
  return left.length ? [tr("wizard:issues.hitPoints", { count: left.length })] : [];
}

/** What the two hands hold, against what the class allows at this level. */
export function spellCounts(
  state: Pick<FormState, "classId" | "level" | "cantrips" | "spells"> &
    Partial<Pick<FormState, "choices">>,
) {
  const caster = Boolean(state.classId) && isSpellcaster(state.classId);
  // An order may add one (Ordre primitif : Magicien).
  const bonus = caster
    ? bonusCantripsFor({ classId: state.classId, level: state.level, picks: state.choices })
    : 0;
  return {
    cantrips: {
      picked: state.cantrips.length,
      cap: caster ? cantripsKnown(state.classId, state.level) + bonus : 0,
    },
    spells: {
      picked: state.spells.length,
      cap: caster ? preparedSpellsCount(state.classId, state.level) : 0,
    },
  };
}

/** `true` when the class casts spells of its own and the sub-step applies. */
export function hasClassSpells(state: Pick<FormState, "classId">): boolean {
  return Boolean(state.classId) && isSpellcaster(state.classId);
}

/** What still blocks the spells sub-step. */
export function spellIssues(
  state: Pick<FormState, "classId" | "level" | "cantrips" | "spells"> &
    Partial<Pick<FormState, "choices">>,
): string[] {
  const counts = spellCounts(state);
  const issues: string[] = [];
  if (counts.cantrips.picked !== counts.cantrips.cap) {
    issues.push(tr("wizard:issues.cantrips", counts.cantrips));
  }
  if (counts.spells.picked !== counts.spells.cap) {
    issues.push(tr("wizard:issues.spells", counts.spells));
  }
  return issues;
}

/**
 * What still blocks the masteries sub-step: every slot filled — a mastery names
 * a kind of weapon, carried or not, so there are always enough to choose from.
 */
export function masteryIssues(
  state: Pick<FormState, "classId" | "level" | "weaponMasteries">,
): string[] {
  const slots = state.classId ? weaponMasteryCount(state.classId, state.level) : 0;
  const picked = state.weaponMasteries.length;
  if (picked > slots) return [tr("wizard:issues.masteriesMax", { picked, slots })];
  return picked < slots ? [tr("wizard:issues.masteries", { picked, needed: slots })] : [];
}

/** What still blocks the Expertise sub-step: the class's count, among proficient skills. */
export function expertiseIssues(
  state: Pick<FormState, "classId" | "level" | "skillExpertise">,
  proficientSkills?: readonly string[],
): string[] {
  const count = state.classId ? skillExpertiseCount(state.classId, state.level) : 0;
  const issues: string[] = [];
  if (state.skillExpertise.length !== count) {
    issues.push(tr("wizard:issues.expertise", { picked: state.skillExpertise.length, count }));
  }
  if (proficientSkills && state.skillExpertise.some((skill) => !proficientSkills.includes(skill))) {
    issues.push(tr("wizard:issues.expertiseProficient"));
  }
  return issues;
}

// --- Rail values -------------------------------------------------------------

/** What the rail prints next to a sub-step once it has an answer. */
export function substepValue(
  sub: Substep,
  state: FormState,
  method: AbilityMethod,
  labelOf: (def: ChoiceDef, value: string) => string,
): string {
  switch (sub.kind) {
    case "identity":
      return state.name;
    case "choices":
      return (sub.defs ?? [])
        .flatMap((def) =>
          (state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []).map((value) =>
            labelOf(def, value),
          ),
        )
        .join(", ");
    case "spells":
      return state.cantrips.length + state.spells.length
        ? `${tr("wizard:rail.cantrips", { count: state.cantrips.length })}, ${tr("wizard:rail.prepared", { count: state.spells.length })}`
        : "";
    case "masteries":
      return state.weaponMasteries.length
        ? tr("wizard:rail.weapons", { count: state.weaponMasteries.length })
        : "";
    case "wildShape":
      return state.wildShapeForms.length
        ? tr("wizard:rail.forms", { count: state.wildShapeForms.length })
        : "";
    case "expertise":
      return state.skillExpertise.length
        ? tr("wizard:rail.skills", { count: state.skillExpertise.length })
        : "";
    case "alignment":
      return state.alignment ? ALIGNMENT_LABELS[state.alignment] : "";
    case "languages":
      return chosenLanguages(state).length
        ? tr("wizard:rail.languages", { count: chosenLanguages(state).length })
        : "";
    case "lore":
      return state.lore.trim() ? tr("wizard:rail.lore") : "";
    case "hitPoints":
      return unsettledHitPointLevels(state.hitPointRolls, state.level).length
        ? ""
        : tr("wizard:rail.hitPointsSettled");
    case "shop": {
      const count = state.inventory.reduce((total, item) => total + (item.quantity ?? 1), 0);
      return count ? tr("wizard:rail.items", { count }) : "";
    }
    case "method":
      return ABILITY_METHOD_LABELS[method];
    case "values":
      return Object.values(state.base).some((value) => value === null)
        ? ""
        : Object.values(state.base).join(" · ");
    case "bonus":
      return Object.entries(state.bonuses)
        .filter(([, value]) => value)
        .map(
          ([ability, value]) => `${ABILITY_ABBR[ability as keyof typeof ABILITY_ABBR]} +${value}`,
        )
        .join(", ");
    default:
      return "";
  }
}

/** The method six base values look like they came from — for a sheet being reopened. */
export function detectMethod(state: Pick<FormState, "base">): AbilityMethod {
  const values = ABILITIES.map((ability) => state.base[ability]);
  if (values.some((value) => value === null)) return "manual";
  const sorted = [...(values as number[])].sort((a, b) => b - a);
  if (sorted.join() === [...STANDARD_ARRAY].sort((a, b) => b - a).join()) return "standardArray";
  const pointBuy = evaluatePointBuy(state.base as Record<(typeof ABILITIES)[number], number>);
  return pointBuy.allScoresInRange && pointBuy.withinBudget ? "pointBuy" : "manual";
}

/** What a method change resets: values from one method mean nothing in another. */
export function baseForMethod(method: AbilityMethod): FormState["base"] {
  return method === "pointBuy"
    ? (Object.fromEntries(ABILITIES.map((ability) => [ability, 8])) as FormState["base"])
    : { ...EMPTY_SCORES };
}
