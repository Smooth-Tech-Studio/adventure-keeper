import {
  hasWildShape,
  knownWildShapeForms,
  resolveChoices,
  skillExpertiseCount,
  weaponMasteryCount,
  wildShapeFormsDue,
  wildShapeRules,
  type ChoiceDef,
} from "@adventure-keeper/system-dnd2024";

import { stateChoiceDefs, type FormState } from "@/systems/dnd2024/character-form/state";
import {
  HIT_POINTS_SUBSTEP,
  SPELLS_SUBSTEP,
  WILD_SHAPE_SUBSTEP,
  choiceSubsteps,
  hasClassSpells,
  spellIssues,
  wildShapeIssues,
  type Substep,
  type SubstepIssue,
} from "@/systems/dnd2024/creation-wizard/substeps";
import { tr } from "@/i18n";

/**
 * The level-up, one question per screen, like the creation.
 *
 * Nothing here knows what a given level brings: the screens come from the
 * **difference** between what `resolveChoices()` opens at the old level and at
 * the new one (a subclass, a feat, the abilities it raises, a fighting style…),
 * plus the counts that grow with the level (spells, Expertise, Weapon Mastery).
 * A new choice in the rules data shows up here by itself.
 */

export type LevelUpKind =
  "gains" | "hitPoints" | "choices" | "spells" | "expertise" | "masteries" | "wildShape" | "review";

export interface LevelUpSubstep extends Omit<Substep, "kind"> {
  kind: LevelUpKind;
}

/** The choices open at `state.level` that were not open at `fromLevel`. */
export function newChoiceDefs(state: FormState, fromLevel: number): ChoiceDef[] {
  const before = new Set(
    resolveChoices({
      classId: state.classId || undefined,
      speciesId: state.speciesId || undefined,
      backgroundId: state.backgroundId || undefined,
      level: fromLevel,
      picks: state.choices,
      invocations: state.eldritchInvocations,
    }).map((def) => def.id),
  );
  return stateChoiceDefs(state).filter((def) => !before.has(def.id));
}

/** `true` when the class gets more Expertise, or the sheet is short of it. */
export function needsExpertise(state: FormState, fromLevel: number): boolean {
  const count = skillExpertiseCount(state.classId, state.level);
  return (
    count > skillExpertiseCount(state.classId, fromLevel) || state.skillExpertise.length < count
  );
}

/** `true` when the class can use one more Weapon Mastery property. */
export function needsMasteries(state: FormState, fromLevel: number): boolean {
  return (
    weaponMasteryCount(state.classId, state.level) > weaponMasteryCount(state.classId, fromLevel)
  );
}

/**
 * `true` when the druid's Wild Shape opens or grows at this level (more forms,
 * a higher CR, flight), or the sheet is short of forms.
 */
export function needsWildShapeForms(state: FormState, fromLevel: number): boolean {
  if (!hasWildShape(state.classId, state.level)) return false;
  if (!hasWildShape(state.classId, fromLevel)) return true;
  const before = wildShapeRules(fromLevel);
  const after = wildShapeRules(state.level);
  return (
    after.formsKnown !== before.formsKnown ||
    after.maxChallengeRating !== before.maxChallengeRating ||
    after.canFly !== before.canFly ||
    knownWildShapeForms(state.wildShapeForms, state.level).length < wildShapeFormsDue(state.level)
  );
}

export function buildLevelUpSubsteps(state: FormState, fromLevel: number): LevelUpSubstep[] {
  const out: LevelUpSubstep[] = [
    {
      key: "gains",
      kind: "gains",
      nav: tr("wizard:levelUp.gains.nav"),
      title: tr("wizard:levelUp.gains.title", {
        level: state.level,
        name: state.name.trim() || tr("wizard:levelUp.gains.yourCharacter"),
      }),
      lead: tr("wizard:levelUp.gains.lead"),
      whyTitle: tr("wizard:levelUp.gains.whyTitle"),
      why: tr("wizard:levelUp.gains.why"),
    },
    {
      ...HIT_POINTS_SUBSTEP,
      kind: "hitPoints",
      title: tr("wizard:levelUp.hitPointsTitle", { level: state.level }),
    },
    ...choiceSubsteps(newChoiceDefs(state, fromLevel)).map((sub) => ({
      ...sub,
      kind: "choices" as const,
    })),
  ];
  if (needsExpertise(state, fromLevel)) {
    out.push({
      key: "expertise",
      kind: "expertise",
      nav: tr("wizard:levelUp.expertise.nav"),
      title: tr("wizard:levelUp.expertise.title"),
      lead: tr("wizard:levelUp.expertise.lead"),
      whyTitle: tr("wizard:levelUp.expertise.whyTitle"),
      why: tr("wizard:levelUp.expertise.why"),
    });
  }
  if (needsMasteries(state, fromLevel)) {
    out.push({
      key: "masteries",
      kind: "masteries",
      nav: tr("wizard:levelUp.masteries.nav"),
      title: tr("wizard:levelUp.masteries.title"),
      lead: tr("wizard:levelUp.masteries.lead"),
      whyTitle: tr("wizard:levelUp.masteries.whyTitle"),
      why: tr("wizard:levelUp.masteries.why"),
    });
  }
  if (needsWildShapeForms(state, fromLevel)) {
    out.push({ ...WILD_SHAPE_SUBSTEP, kind: "wildShape" });
  }
  if (hasClassSpells(state)) {
    out.push({
      ...SPELLS_SUBSTEP,
      kind: "spells",
      title: tr("wizard:levelUp.spells.title"),
      lead: tr("wizard:levelUp.spells.lead"),
      whyTitle: tr("wizard:levelUp.spells.whyTitle"),
      why: tr("wizard:levelUp.spells.why"),
    });
  }
  out.push({
    key: "review",
    kind: "review",
    nav: tr("wizard:levelUp.review.nav"),
    title: tr("wizard:levelUp.review.title", { level: state.level }),
    lead: tr("wizard:levelUp.review.lead"),
    whyTitle: tr("wizard:levelUp.review.whyTitle"),
    why: tr("wizard:levelUp.review.why"),
  });
  return out;
}

/** What still blocks a level-up sub-step. */
export function levelUpIssues(
  sub: LevelUpSubstep,
  state: FormState,
  choiceErrors: Record<string, string>,
): SubstepIssue[] {
  switch (sub.kind) {
    case "choices":
      return (sub.defs ?? [])
        .filter((def) => choiceErrors[def.id])
        .map((def) => ({ message: choiceErrors[def.id], choiceId: def.id }));
    case "spells":
      return spellIssues(state).map((message) => ({ message }));
    case "hitPoints":
      return state.hitPointRolls.some((entry) => entry.level === state.level)
        ? []
        : [{ message: tr("wizard:issues.hitPoints", { count: 1 }) }];
    case "expertise": {
      const count = skillExpertiseCount(state.classId, state.level);
      return state.skillExpertise.length === count
        ? []
        : [
            {
              message: tr("wizard:levelUp.expertiseIssue", {
                picked: state.skillExpertise.length,
                count,
              }),
            },
          ];
    }
    case "wildShape":
      return wildShapeIssues(state).map((message) => ({ message }));
    default:
      return [];
  }
}
