import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import {
  getClass,
  getFeat,
  getSpecies,
  grantedLanguages,
  skillExpertiseCount,
  validateChoices,
  type ChoiceDef,
  type Skill,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  characterToState,
  deriveFormState,
  formStateToInput,
  stateChoiceDefs,
  withChoiceFields,
  withPrunedPicks,
  type FormState,
  type SetForm,
} from "@/systems/dnd2024/character-form/state";
import { ChoiceRenderer } from "@/systems/dnd2024/creation-wizard/choice-renderer";
import { ClassSpellsStep } from "@/systems/dnd2024/creation-wizard/spell-substeps";
import { HIT_POINTS_SUBSTEP } from "@/systems/dnd2024/creation-wizard/substeps";
import { SkillRows } from "@/systems/dnd2024/creation-wizard/visual-choices";
import { WizardRail, type RailSubstep } from "@/systems/dnd2024/creation-wizard/wizard-rail";
import { WizardScreen } from "@/components/wizard/wizard-screen";
import { LevelGainsStep, LevelReview } from "@/systems/dnd2024/level-up/level-up-steps";
import {
  buildLevelUpSubsteps,
  levelUpIssues,
  newChoiceDefs,
  type LevelUpSubstep,
} from "@/systems/dnd2024/level-up/plan";
import { HitPointRollsField } from "@/systems/dnd2024/components/hit-point-rolls";
import { WeaponMasteryPicker } from "@/systems/dnd2024/components/weapon-mastery-picker";
import { WildShapeFormsPicker } from "@/systems/dnd2024/components/wild-shape-forms-picker";
import { useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import {
  buildChoiceContext,
  choiceValueLabel,
  picksForExistingSheet,
  useChoiceCatalogs,
} from "@/systems/dnd2024/lib/choices";
import { updateCharacter, type WithId } from "@/lib/collections";
import { tr } from "@/i18n";

interface Props {
  character: WithId<Dnd2024Character>;
  /** Where to go once done or cancelled (default: the sheet). */
  returnTo?: string;
}

/**
 * Gaining one level, one question per screen — the creation's rail and footer,
 * but only what this level brings. See `plan.ts` for how the screens are found.
 */
export function LevelUpWizard({ character, returnTo }: Props) {
  const { t, i18n } = useTranslation("wizard", { keyPrefix: "levelUp" });
  // Choices and their errors copy translated texts: recomputed on a language change.
  const language = i18n.language;
  const navigate = useNavigate();
  const fromLevel = character.level ?? 1;
  const toLevel = Math.min(20, fromLevel + 1);
  const back = returnTo ?? `/characters/${character.id}`;

  const beforeState = useMemo<FormState>(
    () => ({ ...characterToState(character), choices: picksForExistingSheet(character) }),
    [character],
  );
  const [state, setState] = useState<FormState>(() =>
    withPrunedPicks({ ...beforeState, level: toLevel }),
  );
  const [subIndex, setSubIndex] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useRegisterPacks(state.packContent);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allDefs = useMemo(() => stateChoiceDefs(state), [state, language]);
  const catalogs = useChoiceCatalogs(allDefs);
  const context = useMemo(() => buildChoiceContext(catalogs), [catalogs]);
  const choiceErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of validateChoices(allDefs, state.choices, state.level, context)) {
      map[error.choiceId] ??= error.message;
    }
    return map;
  }, [allDefs, state.choices, state.level, context]);

  const before = useMemo(() => deriveFormState(beforeState), [beforeState]);
  const after = useMemo(() => deriveFormState(withChoiceFields(state)), [state]);

  const klass = getClass(state.classId)!;
  const species = getSpecies(state.speciesId);
  const subs = buildLevelUpSubsteps(state, fromLevel);
  const safeSub = Math.min(subIndex, subs.length - 1);
  const sub = subs[safeSub];
  const issuesOf = (entry: LevelUpSubstep) => levelUpIssues(entry, state, choiceErrors);
  const issues = issuesOf(sub);
  const isLast = safeSub === subs.length - 1;

  const set: SetForm = (key, value) => setState((current) => ({ ...current, [key]: value }));

  function setPick(choiceId: string, values: string[]) {
    setState((current) => {
      const others = current.choices.filter((pick) => pick.choiceId !== choiceId);
      return withPrunedPicks({
        ...current,
        choices: values.length > 0 ? [...others, { choiceId, values }] : others,
      });
    });
  }

  function reachable(index: number): boolean {
    if (seen.has(subs[index]?.key)) return true;
    return subs.slice(0, index).every((entry) => issuesOf(entry).length === 0);
  }

  function goto(index: number) {
    setSubmitted(false);
    setSeen((current) => new Set(current).add(sub.key));
    setSubIndex(index);
    window.scrollTo({ top: 0 });
  }

  function goNext() {
    if (issues.length > 0) {
      setSubmitted(true);
      toast.error(issues[0].message);
      return;
    }
    goto(safeSub + 1);
  }

  async function finish() {
    const blocker = subs.findIndex((entry) => issuesOf(entry).length > 0);
    if (blocker >= 0) {
      goto(blocker);
      setSubmitted(true);
      toast.error(t("choiceLeft"));
      return;
    }
    setSaving(true);
    try {
      await updateCharacter(character.id, formStateToInput(withChoiceFields(state)));
      toast.success(
        t("done", { name: state.name.trim() || t("yourCharacterCap"), level: state.level }),
      );
      navigate(back, { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const labelOf = (def: ChoiceDef, value: string) => choiceValueLabel(def, value, catalogs);
  const subValue = (entry: LevelUpSubstep): string => {
    switch (entry.kind) {
      case "choices":
        return (entry.defs ?? [])
          .flatMap((def) =>
            (state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []).map((value) =>
              labelOf(def, value),
            ),
          )
          .join(", ");
      case "spells":
        return t("railSpells", { cantrips: state.cantrips.length, spells: state.spells.length });
      case "expertise":
        return state.skillExpertise.length
          ? t("railSkills", { count: state.skillExpertise.length })
          : "";
      case "wildShape":
        return state.wildShapeForms.length
          ? tr("wizard:rail.forms", { count: state.wildShapeForms.length })
          : "";
      case "hitPoints": {
        const entry = state.hitPointRolls.find((row) => row.level === state.level);
        if (!entry) return "";
        return entry.roll === undefined ? t("railAverage") : t("railRoll", { roll: entry.roll });
      }
      default:
        return "";
    }
  };
  const railSubsteps: RailSubstep[] = subs.map((entry, index) => ({
    sub: entry,
    value: subValue(entry),
    done: seen.has(entry.key) && issuesOf(entry).length === 0,
    reachable: reachable(index),
  }));
  const feats = (after?.featIds ?? [])
    .map((id) => getFeat(id)?.name)
    .filter((name): name is string => Boolean(name));
  const languages = [
    ...grantedLanguages({
      speciesId: state.speciesId || undefined,
      classId: state.classId || undefined,
    }).map((entry) => entry.id),
    ...state.languages,
  ].filter((id, index, all) => all.indexOf(id) === index);
  const subclassId = state.choices.find(
    (pick) => pick.choiceId === `class:${state.classId}:subclass`,
  )?.values[0];

  function renderBody() {
    switch (sub.kind) {
      case "gains":
        return (
          <LevelGainsStep
            before={before}
            after={after}
            state={state}
            fromLevel={fromLevel}
            klass={klass}
            subclassId={subclassId}
            upcoming={subs.slice(1, -1).map((entry) => entry.nav)}
            hitPointsChosen={seen.has(HIT_POINTS_SUBSTEP.key)}
          />
        );
      case "choices":
        return (
          <div className="flex flex-col gap-5">
            {(sub.defs ?? []).map((def) => (
              <section key={def.id} className="bg-card rounded-xl border p-4">
                <ChoiceRenderer
                  def={def}
                  values={state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []}
                  onChange={(values) => setPick(def.id, values)}
                  catalogs={catalogs}
                  context={context}
                  error={submitted ? choiceErrors[def.id] : undefined}
                  scores={after?.adjustedAbilityScores}
                  proficiencyBonus={after?.proficiencyBonus}
                  classId={state.classId || undefined}
                  picks={state.choices}
                />
              </section>
            ))}
          </div>
        );
      case "hitPoints":
        return (
          <HitPointRollsField
            hitDie={klass?.hitDie ?? 8}
            conModifier={after?.abilityModifiers.con ?? 0}
            levels={[state.level]}
            rolls={state.hitPointRolls}
            onChange={(rolls) => set("hitPointRolls", rolls)}
          />
        );
      case "spells":
        return <ClassSpellsStep state={state} set={set} showErrors={submitted} />;
      case "expertise": {
        const count = skillExpertiseCount(state.classId, state.level);
        return (
          <section className="bg-card rounded-xl border p-4">
            <SkillRows
              def={{
                id: "class:expertise",
                source: "class",
                kind: "skill",
                label: "Expertise",
                count,
                pool: { kind: "list", values: after?.proficientSkills ?? [] },
              }}
              pool={after?.proficientSkills ?? []}
              values={state.skillExpertise}
              onChange={(values) => set("skillExpertise", values as Skill[])}
              catalogs={catalogs}
              scores={after?.adjustedAbilityScores}
              proficiencyBonus={(after?.proficiencyBonus ?? 2) * 2}
            />
          </section>
        );
      }
      case "masteries":
        return (
          <section className="bg-card rounded-xl border p-4">
            <WeaponMasteryPicker
              classId={state.classId}
              level={state.level}
              weapons={state.weapons}
              value={state.weaponMasteries}
              onChange={(ids) => set("weaponMasteries", ids)}
            />
          </section>
        );
      case "wildShape":
        return (
          <WildShapeFormsPicker
            level={state.level}
            value={state.wildShapeForms}
            onChange={(ids) => set("wildShapeForms", ids)}
          />
        );
      case "review":
        return (
          <LevelReview
            before={before}
            after={after}
            beforeState={beforeState}
            state={state}
            defs={newChoiceDefs(state, fromLevel)}
            labelOf={labelOf}
          />
        );
    }
  }

  const next = subs[safeSub + 1];
  const looseIssues = submitted ? issues.filter((issue) => !issue.choiceId) : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <WizardRail
        steps={[{ id: "level", label: t("step", { from: fromLevel, to: toLevel }) }]}
        heading={t("heading")}
        stepIndex={0}
        subIndex={safeSub}
        substeps={railSubsteps}
        stepValue={() => ""}
        stepDone={() => false}
        stepReachable={() => true}
        onGoto={(_, index) => goto(index)}
        state={state}
        derived={after}
        klass={klass}
        species={species}
        skills={(after?.proficientSkills ?? []) as Skill[]}
        feats={feats}
        languages={languages}
        onCancel={() => navigate(back)}
        saving={saving}
        footer={
          <Button type="button" variant="ghost" onClick={() => navigate(back)}>
            {t("quit")}
          </Button>
        }
      />
      <WizardScreen
        eyebrow={t("eyebrow", { level: toLevel, current: safeSub + 1, total: subs.length })}
        segments={railSubsteps.map((entry) => ({ key: entry.sub.key, done: entry.done }))}
        current={safeSub}
        title={sub.title}
        lead={sub.lead}
        why={sub.why}
        whyTitle={sub.whyTitle}
        issues={looseIssues.map((issue) => issue.message)}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => goto(safeSub - 1)}
              disabled={safeSub === 0}
            >
              <ChevronLeftIcon /> {t("previous")}
            </Button>
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(back)}
              className="lg:hidden"
            >
              {t("cancel")}
            </Button>
            {isLast ? (
              <Button type="button" onClick={finish} disabled={saving}>
                <CheckIcon /> {saving ? t("saving") : t("validate", { level: toLevel })}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={saving}>
                {t("next")}
                {next && <span className="font-normal opacity-75 max-sm:hidden">· {next.nav}</span>}
                <ChevronRightIcon />
              </Button>
            )}
          </>
        }
      >
        {renderBody()}
      </WizardScreen>
    </div>
  );
}
