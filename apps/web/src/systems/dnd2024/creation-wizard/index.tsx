import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListChecksIcon,
  PencilIcon,
  SaveIcon,
} from "lucide-react";
import type { Dnd2024Character, Dnd2024CharacterDraft } from "@adventure-keeper/schemas";
import {
  choiceDerivedInput,
  choiceStep,
  computeCharacterDerived,
  evaluatePointBuy,
  getBackground,
  getClass,
  getFeat,
  getSpecies,
  grantedLanguages,
  resolveChoices,
  skillExpertiseCount,
  validateBackgroundBonuses,
  validateChoices,
  type AbilityMethod,
  type CreatureSize,
  type Skill,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  characterToState,
  deriveFormState,
  stateChoiceDefs,
  emptyState,
  formStateToDraftInput,
  formStateToInput,
  scoreBlock,
  validateForm,
  withChoiceFields,
  withPrunedPicks,
  type FormState,
  type SetForm,
} from "@/systems/dnd2024/character-form/state";
import {
  BonusStep,
  MethodStep,
  RecapStep,
  ValuesStep,
} from "@/systems/dnd2024/creation-wizard/ability-substeps";
import { ChoiceRenderer } from "@/systems/dnd2024/creation-wizard/choice-renderer";
import { SkillRows } from "@/systems/dnd2024/creation-wizard/visual-choices";
import { WeaponMasteryPicker } from "@/systems/dnd2024/components/weapon-mastery-picker";
import { WildShapeFormsPicker } from "@/systems/dnd2024/components/wild-shape-forms-picker";
import { HitPointRollsField } from "@/systems/dnd2024/components/hit-point-rolls";
import { EntityPortrait } from "@/systems/dnd2024/creation-wizard/entity-art";
import {
  ClassFilterSelect,
  EntityCarousel,
  type ClassFilter,
} from "@/systems/dnd2024/creation-wizard/entity-carousel";
import { KitStep } from "@/systems/dnd2024/creation-wizard/equipment-substeps";
import { CreationReview, type ReviewTodo } from "@/systems/dnd2024/creation-wizard/creation-review";
import type { EditBlock, SheetOrigin } from "@/components/character/character-sheet/types";
import {
  AlignmentGrid,
  ClassFeaturesStep,
  IdentityStep,
  LanguagePicker,
  LoreStep,
  SpeciesTraitsStep,
} from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import { StepShop } from "@/systems/dnd2024/creation-wizard/step-shop";
import {
  CREATION_STEPS,
  ABILITIES_STEP,
  rebuildSteps,
  type CreationStepDef,
} from "@/systems/dnd2024/creation-wizard/steps";
import {
  baseForMethod,
  IMPACT_SUBSTEP,
  buildSubsteps,
  detectMethod,
  entityIdOf,
  pendingLabel,
  substepIssues,
  substepValue,
  type Substep,
  type SubstepIssue,
} from "@/systems/dnd2024/creation-wizard/substeps";
import { WizardRail, type RailSubstep } from "@/systems/dnd2024/creation-wizard/wizard-rail";
import { WizardScreen } from "@/components/wizard/wizard-screen";
import { originImpact } from "@/systems/dnd2024/creation-wizard/impact";
import { ImpactStep } from "@/systems/dnd2024/creation-wizard/impact-step";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { findSpell, useSpells } from "@/systems/dnd2024/lib/spells";
import { ClassSpellsStep } from "@/systems/dnd2024/creation-wizard/spell-substeps";
import { useAuth } from "@/hooks/use-auth";
import {
  clearWizardSnapshot,
  saveWizardSnapshot,
  useWizardAutosave,
  type WizardSnapshot,
} from "@/hooks/use-wizard-autosave";
import {
  buildChoiceContext,
  choiceValueLabel,
  picksForExistingSheet,
  useChoiceCatalogs,
} from "@/systems/dnd2024/lib/choices";
import type { ItemDraft } from "@/systems/dnd2024/lib/items";
import { formatPurse, fromCopper } from "@/systems/dnd2024/lib/money";
import { buildStartingKit, itemsCostCp, kitPurseCp } from "@/systems/dnd2024/lib/starting-kit";
import {
  createCharacter,
  createCharacterDraft,
  updateCharacter,
  updateCharacterDraft,
  type WithId,
} from "@/lib/collections";
import { useContentPacks, useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { currentLanguage, tr } from "@/i18n";
import { previewDnd2024Character } from "@/systems/dnd2024/lib/character-storage";

interface Props {
  /** A draft being resumed, or a finished sheet reopened in the wizard. */
  character?: WithId<Dnd2024Character> | WithId<Dnd2024CharacterDraft>;
  /** Where to go once the character is created (default: the character list). */
  returnTo?: string;
  /**
   * A creation left on this device, which the player chose to pick up. The
   * offer is made by the page, before the wizard opens.
   */
  resume?: WizardSnapshot<FormState>;
  /**
   * A finished sheet whose species, class or background changes: the wizard
   * shows that step alone, leaves the level and the equipment alone, shows
   * what the change removes before going on, and saves the sheet in place.
   */
  rebuild?: "class" | "species" | "background";
}

/**
 * The guided creation: five steps, each cut into sub-steps that ask one thing
 * at a time (see `substeps.ts`).
 *
 * The wizard owns no rules of its own. `resolveChoices()` says which choices are
 * open, `validateChoices()` says whether they are complete, and every choice
 * becomes its own screen — so a new choice in the rules data shows up here by
 * itself.
 */
export function CreationWizard({ character, returnTo, resume, rebuild }: Props) {
  const { t, i18n } = useTranslation("wizard", { keyPrefix: "shell" });
  // Choices, errors and the kit copy translated texts: recomputed on a language change.
  const language = i18n.language;
  const { user } = useAuth();
  const navigate = useNavigate();
  // Pack species, backgrounds, subclasses and feats come through the lookups;
  // reading the overlay here re-renders the wizard when packs load.
  const { overlay } = useContentPacks();

  // A sheet written before the wizard has its picks in the dedicated fields;
  // read them back so reopening it shows what was already chosen.
  const [state, setState] = useState<FormState>(() => {
    if (!character) return resume?.state ?? emptyState();
    return { ...characterToState(character), choices: picksForExistingSheet(character) };
  });
  const steps = useMemo(() => (rebuild ? rebuildSteps(rebuild) : CREATION_STEPS), [rebuild]);
  const [stepNumber, setStepNumber] = useState(() =>
    rebuild ? 1 : (character?.creationStep ?? resume?.step ?? 1),
  );
  const [subIndex, setSubIndex] = useState(0);
  /** Sub-steps already shown (`"step:key"`): the rail lets the player jump back to them. */
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  /** Sent back from the review to fix one block: a way straight back to it. */
  const [fromReview, setFromReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(character?.id);
  const [method, setMethod] = useState<AbilityMethod>(() =>
    rebuild && character ? detectMethod(characterToState(character)) : "standardArray",
  );
  const [rolled, setRolled] = useState<number[]>([]);
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  // Rebuild only: the sheet as stored, the changes the player confirmed
  // (`"species:human"`), and the last check before applying.
  const [original] = useState<FormState | null>(() =>
    rebuild && character
      ? { ...characterToState(character), choices: picksForExistingSheet(character) }
      : null,
  );
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const spellDictionary = useSpells(Boolean(rebuild));

  const stepIndex = stepNumber - 1;
  const step = steps[stepIndex];
  /** No account yet: everything stays on this device until the player signs up. */
  const guest = !user;

  // Only for a creation started from scratch: a stored draft is already safe.
  useWizardAutosave(state, stepNumber, !character);

  // A reopened sheet keeps resolving the pack entries it already uses.
  useRegisterPacks(state.packContent);

  // --- Choices ------------------------------------------------------------

  const allDefs = useMemo(
    () =>
      resolveChoices({
        classId: state.classId || undefined,
        speciesId: state.speciesId || undefined,
        backgroundId: state.backgroundId || undefined,
        level: state.level,
        picks: state.choices,
        invocations: state.eldritchInvocations,
      }),
    // `overlay`: the same ids resolve to new choices once the packs load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.classId,
      state.speciesId,
      state.backgroundId,
      state.level,
      state.choices,
      state.eldritchInvocations,
      overlay,
      language,
    ],
  );
  const catalogs = useChoiceCatalogs(allDefs);
  const context = useMemo(() => buildChoiceContext(catalogs), [catalogs]);

  const choiceErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of validateChoices(allDefs, state.choices, state.level, context)) {
      map[error.choiceId] ??= error.message;
    }
    return map;
  }, [allDefs, state.choices, state.level, context]);

  const set: SetForm = (key, value) => {
    setState((current) => {
      const next = { ...current, [key]: value };
      return key === "level" ? withPrunedPicks(next) : next;
    });
  };

  function setPick(choiceId: string, values: string[]) {
    setState((current) => {
      const others = current.choices.filter((pick) => pick.choiceId !== choiceId);
      return withPrunedPicks({
        ...current,
        choices: values.length > 0 ? [...others, { choiceId, values }] : others,
      });
    });
  }

  // --- Entities, kit, derived ----------------------------------------------

  const klass = state.classId ? getClass(state.classId) : undefined;
  const species = state.speciesId ? getSpecies(state.speciesId) : undefined;
  const background = state.backgroundId ? getBackground(state.backgroundId) : undefined;

  /**
   * What the chosen packages hand over. Derived, never stored: changing an
   * equipment pick at step 1 or 3 simply changes this.
   */
  const kit = useMemo(
    () =>
      // A finished sheet already carries its equipment: no package is added.
      rebuild
        ? buildStartingKit({ picks: [], catalogs })
        : buildStartingKit({
            classId: state.classId || undefined,
            backgroundId: state.backgroundId || undefined,
            picks: state.choices,
            catalogs,
          }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rebuild, state.classId, state.backgroundId, state.choices, catalogs, language],
  );
  const kitArmors = useMemo(() => equipStartingArmor(kit.armors), [kit.armors]);
  const carriedWeapons = useMemo(() => [...kit.weapons, ...state.weapons], [kit, state.weapons]);
  const purseCp = kitPurseCp(kit) - itemsCostCp(state.inventory);

  const block = useMemo(() => scoreBlock(state.base), [state.base]);
  const derived = useMemo(() => {
    if (!block || !state.classId) return null;
    return computeCharacterDerived({
      classId: state.classId,
      level: state.level,
      baseAbilityScores: block,
      backgroundAbilityBonuses: state.bonuses,
      backgroundId: state.backgroundId || undefined,
      speciesId: state.speciesId || undefined,
      choices: state.choices,
      hitPointRolls: state.hitPointRolls,
      weapons: carriedWeapons,
      weaponMasteries: state.weaponMasteries,
      skillExpertise: state.skillExpertise,
      armors: [...kitArmors, ...state.armors],
      tools: [...kit.tools, ...state.tools],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, state, carriedWeapons, kit, kitArmors, overlay]);

  // --- Sub-steps ------------------------------------------------------------

  /** `"species:human"` — what an « impact » screen confirms. */
  const changeKey = (index: number) => {
    const entity = steps[index].entity;
    return entity ? `${entity}:${entityIdOf(entity, state)}` : "";
  };

  const subsOf = (index: number): Substep[] => {
    const def = steps[index];
    const list = buildSubsteps(def, {
      state,
      stepDefs: allDefs.filter((choice) => def.sources?.includes(choiceStep(choice))),
      klass,
      species,
      background,
    });
    if (!original) return list;
    // A rebuild keeps the level and the equipment, and keeps the values as
    // they are; a new species, class or background is shown before anything else.
    const kept = list.filter(
      (entry) =>
        entry.kind !== "identity" && entry.kind !== "method" && !entry.key.endsWith(":equipment"),
    );
    if (def.entity && entityIdOf(def.entity, state) !== entityIdOf(def.entity, original)) {
      kept.splice(1, 0, IMPACT_SUBSTEP);
      kept.push(...scoreFollowUps(def.entity));
    }
    return kept;
  };

  /**
   * The abilities' step is not part of a rebuild, but a new class brings its
   * own level feats and hit die, and a new background its own ability
   * bonuses: those screens close the step that changed them.
   */
  function scoreFollowUps(entity: NonNullable<CreationStepDef["entity"]>): Substep[] {
    if (entity === "species") return [];
    const kinds: Substep["kind"][] = entity === "class" ? ["hitPoints", "choices"] : ["bonus"];
    return buildSubsteps(ABILITIES_STEP, {
      state,
      stepDefs: allDefs.filter((choice) => ABILITIES_STEP.sources?.includes(choiceStep(choice))),
      klass,
      species,
      background,
    }).filter((entry) => kinds.includes(entry.kind));
  }

  const pointBuyError = useMemo(() => {
    if (method !== "pointBuy" || !block) return undefined;
    const result = evaluatePointBuy(block);
    if (!result.allScoresInRange) return t("pointBuyRange");
    if (!result.withinBudget) return t("pointBuyOver", { total: result.total });
    return undefined;
  }, [method, block, t]);
  const bonusError = useMemo(() => {
    if (!state.backgroundId) return t("pickBackgroundFirst");
    const result = validateBackgroundBonuses(state.backgroundId, state.bonuses);
    return result.valid ? undefined : (result.reason ?? t("invalidBonuses"));
  }, [state.backgroundId, state.bonuses, t]);

  // A rebuild does not hold the player to a pick the stored sheet already
  // lacked (a feat chosen before the wizard existed): only new gaps block.
  const inheritedGaps = useMemo(() => {
    if (!original) return new Set<string>();
    const defs = stateChoiceDefs(original);
    return new Set(
      validateChoices(defs, original.choices, original.level, context).map(
        (error) => error.choiceId,
      ),
    );
  }, [original, context]);

  // Also what Expertise picks from, before the scores exist.
  const fromChoices = choiceDerivedInput(allDefs, state.choices);
  const railSkills =
    derived?.proficientSkills ??
    ([
      ...new Set([
        ...(background?.skillProficiencies ?? []),
        ...fromChoices.skillProficiencies,
        ...fromChoices.speciesSkillProficiencies,
      ]),
    ] as Skill[]);

  const issuesOf = (index: number, sub: Substep): SubstepIssue[] =>
    sub.kind === "impact"
      ? acknowledged.has(changeKey(index))
        ? []
        : [{ message: tr("wizard:shell2.confirmChange") }]
      : substepIssues(sub, steps[index], {
          state,
          choiceErrors,
          bonusError,
          pointBuyError,
          proficientSkills: railSkills,
        }).filter((issue) =>
          issue.choiceId
            ? !inheritedGaps.has(issue.choiceId)
            : // The same problem on the stored sheet (no languages picked yet…).
              !original ||
              !substepIssues(sub, steps[index], { state: original, choiceErrors: {} }).some(
                (old) => old.message === issue.message,
              ),
        );

  const subs = subsOf(stepIndex);
  const safeSub = Math.min(subIndex, subs.length - 1);
  const sub = subs[safeSub];
  const issues = issuesOf(stepIndex, sub);

  /** The first sub-step, anywhere, that still blocks: what « Valider » sends the player to. */
  function firstBlocker(): { stepIndex: number; subIndex: number } | null {
    for (let index = 0; index < steps.length; index++) {
      const list = subsOf(index);
      const at = list.findIndex((entry) => issuesOf(index, entry).length > 0);
      if (at >= 0) return { stepIndex: index, subIndex: at };
      if (pendingLabel(steps[index]) && !entityIdOf(steps[index].entity!, state)) {
        return { stepIndex: index, subIndex: 0 };
      }
    }
    return null;
  }

  /** Reachable when everything before it is complete, or when it was already shown. */
  function reachable(index: number, at: number): boolean {
    if (seen.has(`${index}:${subsOf(index)[at]?.key}`)) return true;
    const blocker = firstBlocker();
    return (
      !blocker ||
      blocker.stepIndex > index ||
      (blocker.stepIndex === index && blocker.subIndex >= at)
    );
  }

  function goto(index: number, at: number) {
    setSubmitted(false);
    setSeen((current) => new Set(current).add(`${stepIndex}:${sub.key}`));
    setStepNumber(index + 1);
    setSubIndex(at);
    if (subsOf(index)[at]?.key === "review") setFromReview(false);
    window.scrollTo({ top: 0 });
  }

  function gotoKey(index: number, key: string) {
    goto(
      index,
      Math.max(
        0,
        subsOf(index).findIndex((entry) => entry.key === key),
      ),
    );
  }

  function goNext() {
    if (issues.length > 0) {
      setSubmitted(true);
      toast.error(issues[0].message);
      return;
    }
    if (safeSub < subs.length - 1) goto(stepIndex, safeSub + 1);
    else if (stepIndex < steps.length - 1) goto(stepIndex + 1, 0);
  }

  /** Back to the review in one click, once this sub-step is fine. */
  function backToReview() {
    if (issues.length > 0) {
      setSubmitted(true);
      toast.error(issues[0].message);
      return;
    }
    gotoKey(steps.length - 1, "review");
  }

  function goBack() {
    if (safeSub > 0) goto(stepIndex, safeSub - 1);
    else if (stepIndex > 0) goto(stepIndex - 1, subsOf(stepIndex - 1).length - 1);
  }

  /** Picking a class, species or background moves straight on to its first question. */
  function chooseEntity(entity: NonNullable<CreationStepDef["entity"]>, value: string) {
    setState((current) =>
      withPrunedPicks({
        ...current,
        ...(entity === "class"
          ? {
              classId: value,
              // Another class, another spell list: the hands start empty.
              ...(value !== current.classId
                ? { cantrips: [], spells: [], eldritchInvocations: [] }
                : {}),
            }
          : entity === "species"
            ? { speciesId: value }
            : { backgroundId: value }),
      }),
    );
    goto(stepIndex, 1);
  }

  function changeMethod(next: AbilityMethod) {
    if (next === method) return;
    setMethod(next);
    // Values from one method mean nothing in another — start the column clean.
    set("base", baseForMethod(next));
    if (next !== "roll") setRolled([]);
  }

  // --- Saving -------------------------------------------------------------

  /**
   * Choices are the source of truth, but the dedicated fields are what the
   * edit form still reads — so both are written until that form is migrated.
   */
  function stateForSave(current: FormState): FormState {
    // A rebuilt sheet keeps its own equipment and purse.
    if (rebuild) return withChoiceFields(current);
    // `state.inventory` holds only what the shop sold; the packages' lines are
    // merged in here so going back and changing a package cannot leave strays.
    const weapons = [...kit.weapons, ...current.weapons];
    return withChoiceFields({
      ...current,
      weapons,
      // The armour the wizard counted in the AC is worn on the sheet too.
      armors: [...kitArmors, ...current.armors],
      tools: [...kit.tools, ...current.tools],
      inventory: [...kit.inventory, ...current.inventory],
      money: fromCopper(Math.max(0, purseCp)),
    });
  }

  /**
   * A guest saves by making an account: the creation is written to this device
   * now, and the sign-up page sends the player back to it (`?resume=1`).
   */
  function handOffToAccount() {
    saveWizardSnapshot(state, stepNumber);
    const back = new URLSearchParams({ resume: "1" });
    if (returnTo) back.set("returnTo", returnTo);
    toast.info(t("guestHandOff"));
    navigate("/signup", { state: { from: `/characters/new?${back}` } });
  }

  async function saveDraft() {
    if (!user) {
      handOffToAccount();
      return;
    }
    setSaving(true);
    try {
      const input = { ...formStateToDraftInput(stateForSave(state)), creationStep: stepNumber };
      if (draftId) {
        await updateCharacterDraft(draftId, input);
      } else {
        setDraftId(await createCharacterDraft(input, user.uid));
      }
      clearWizardSnapshot();
      setSavedAt(
        new Date().toLocaleTimeString(currentLanguage(), { hour: "2-digit", minute: "2-digit" }),
      );
      toast.success(t("draftSaved"));
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    const blocker = firstBlocker();
    if (blocker) {
      goto(blocker.stepIndex, blocker.subIndex);
      setSubmitted(true);
      toast.error(t("choiceLeft"));
      return;
    }
    const ready = stateForSave(state);
    const errors = validateForm(ready);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0] as string);
      return;
    }
    if (!user) {
      handOffToAccount();
      return;
    }
    // A rebuild shows what it removes one last time before writing.
    if (rebuild && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      const input = formStateToInput(ready);
      if (draftId) await updateCharacter(draftId, input);
      else await createCharacter(input, user.uid);
      if (!rebuild) clearWizardSnapshot();
      toast.success(rebuild ? t("sheetUpdated") : t("created"));
      navigate(returnTo ?? "/characters", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    navigate(returnTo ?? (guest ? "/" : "/characters"));
  }

  // --- Rail data ----------------------------------------------------------

  const labelOf = (def: Parameters<typeof choiceValueLabel>[0], value: string) =>
    choiceValueLabel(def, value, catalogs);
  const railSubsteps: RailSubstep[] = subs.map((entry, index) => ({
    sub: entry,
    value: substepValue(entry, state, method, labelOf),
    done: seen.has(`${stepIndex}:${entry.key}`) && issuesOf(stepIndex, entry).length === 0,
    reachable: reachable(stepIndex, index),
  }));
  const entityName = (def: CreationStepDef) =>
    def.entity === "class"
      ? klass?.name
      : def.entity === "species"
        ? species?.name
        : def.entity === "background"
          ? background?.name
          : undefined;
  const stepValue = (index: number) => {
    const def = steps[index];
    if (def.entity) {
      const name = entityName(def);
      return name
        ? def.entity === "class"
          ? t("classLevel", { name, level: state.level })
          : name
        : "";
    }
    if (def.id === "abilities") return block ? Object.values(block).join(" · ") : "";
    // The purse means something only once the player has been there.
    return seen.has(`${index}:kit`)
      ? t("purse", { amount: formatPurse(fromCopper(Math.max(0, purseCp))) })
      : "";
  };
  const railFeats = [
    ...(background?.originFeatId ? [getFeat(background.originFeatId)?.name ?? ""] : []),
    ...allDefs
      .filter(
        (def) =>
          def.kind === "option" && !def.id.endsWith(":subclass") && !def.id.endsWith(":equipment"),
      )
      .flatMap((def) =>
        (state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []).map(
          (value) => getFeat(value)?.name,
        ),
      )
      .filter((name): name is string => Boolean(name)),
  ];
  const railLanguages = [
    ...grantedLanguages({
      speciesId: state.speciesId || undefined,
      classId: state.classId || undefined,
    }).map((entry) => entry.id),
    ...state.languages,
  ].filter((id, index, all) => all.indexOf(id) === index);

  // --- Screen ---------------------------------------------------------------

  const review = (): ReviewTodo[] => {
    const todo: ReviewTodo[] = [];
    steps.forEach((def, index) => {
      if (def.entity && !entityIdOf(def.entity, state)) {
        todo.push({ stepIndex: index, key: "pick", label: def.label });
        return;
      }
      for (const entry of subsOf(index)) {
        if (issuesOf(index, entry).length > 0)
          todo.push({ stepIndex: index, key: entry.key, label: `${def.label} › ${entry.nav}` });
      }
    });
    return todo;
  };

  /** Index of a step by id (a rebuild has fewer steps), or -1. */
  const stepOf = (id: string) => steps.findIndex((def) => def.id === id);

  /** Where a block of the sheet is set, in the wizard: its step and sub-step. */
  function editTarget(block: EditBlock | SheetOrigin): [string, string] {
    const classId = state.classId;
    const classSub = (pattern: RegExp, fallback: string) =>
      subsOf(stepOf("class")).find((entry) => pattern.test(entry.key))?.key ?? fallback;
    switch (block) {
      case "identity":
        return ["class", "identity"];
      case "abilities":
        return ["abilities", "values"];
      case "skills":
        return ["class", `class:${classId}:skills`];
      case "proficiencies":
        return ["background", "languages"];
      case "spells":
        return ["class", classSub(/cantrips|spells/, "features")];
      case "equipment":
        return ["shop", "shop"];
      case "wildShape":
        return ["class", "wildShape"];
      case "lore":
        return ["background", "lore"];
      case "subclass":
        return ["class", classSub(/:subclass$/, "features")];
      case "species":
        return ["species", "pick"];
      case "background":
        return ["background", "pick"];
      default:
        // class, feats, options: the class's features and choices.
        return ["class", "features"];
    }
  }

  /** The block of the sheet a review entry falls in, to outline it. */
  function todoBlock(entry: ReviewTodo): EditBlock | SheetOrigin {
    const id = steps[entry.stepIndex]?.id;
    const key = entry.key;
    if (id === "abilities") return "abilities";
    if (id === "shop") return "equipment";
    if (id === "species") return "species";
    if (id === "background") {
      if (key === "languages") return "proficiencies";
      if (key === "lore") return "lore";
      if (key === "alignment") return "identity";
      return "background";
    }
    if (key === "identity") return "identity";
    if (key.endsWith(":skills") || key === "expertise") return "skills";
    if (/cantrips|spells/.test(key)) return "spells";
    if (key === "wildShape") return "wildShape";
    if (key === "hit-points") return "abilities";
    if (key.endsWith(":subclass")) return "subclass";
    return "class";
  }

  const body = renderBody();
  const isLast = stepIndex === steps.length - 1 && safeSub === subs.length - 1;
  const next = safeSub < subs.length - 1 ? subs[safeSub + 1] : undefined;
  const nextLabel = next
    ? next.nav
    : !isLast
      ? t("nextStep", { number: stepIndex + 2, label: steps[stepIndex + 1].label })
      : "";
  const skippable = sub.optional && !substepValue(sub, state, method, labelOf);
  const contextEntity = step.entity
    ? { id: entityIdOf(step.entity, state), name: entityName(step) }
    : klass
      ? { id: klass.id, name: klass.name }
      : undefined;
  const contextImage = contextEntity?.id
    ? (step.entity === "species"
        ? getSpecies(contextEntity.id)
        : step.entity === "background"
          ? getBackground(contextEntity.id)
          : getClass(contextEntity.id)
      )?.imageUrl
    : undefined;
  const looseIssues = submitted ? issues.filter((issue) => !issue.choiceId) : [];

  /** What the rebuild does to the stored sheet, so far. */
  function currentImpact() {
    const now = withChoiceFields(state);
    const spellName = (id: string) =>
      (spellDictionary && findSpell(spellDictionary, id)?.name) || id;
    return originImpact(
      original!,
      now,
      deriveFormState(original!),
      deriveFormState(now),
      spellName,
    );
  }

  function renderBody() {
    switch (sub.kind) {
      case "impact":
        return original ? (
          <ImpactStep
            impact={currentImpact()}
            upcoming={subs.slice(safeSub + 1).map((entry) => entry.nav)}
            acknowledged={acknowledged.has(changeKey(stepIndex))}
            onAcknowledge={(value) =>
              setAcknowledged((current) => {
                const next = new Set(current);
                if (value) next.add(changeKey(stepIndex));
                else next.delete(changeKey(stepIndex));
                return next;
              })
            }
          />
        ) : null;
      case "pick":
        return (
          <EntityCarousel
            key={step.id}
            entity={step.entity!}
            value={entityIdOf(step.entity!, state)}
            onChoose={(value) => chooseEntity(step.entity!, value)}
            catalogs={catalogs}
            filter={step.entity === "class" ? classFilter : "all"}
          />
        );
      case "identity":
        return (
          <IdentityStep
            state={state}
            set={set}
            klass={klass!}
            species={species}
            showErrors={submitted}
          />
        );
      case "choices":
        return (
          <div className="flex flex-col gap-5">
            {(sub.defs ?? []).map((def) => (
              <section
                key={def.id}
                id={`choice-${def.id}`}
                className="bg-card rounded-xl border p-4"
              >
                <ChoiceRenderer
                  def={def}
                  values={state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []}
                  onChange={(values) => setPick(def.id, values)}
                  catalogs={catalogs}
                  context={context}
                  error={submitted ? choiceErrors[def.id] : undefined}
                  scores={derived?.adjustedAbilityScores}
                  proficiencyBonus={derived?.proficiencyBonus}
                  classId={state.classId || undefined}
                  picks={state.choices}
                />
              </section>
            ))}
          </div>
        );
      case "classFeatures":
        return (
          <ClassFeaturesStep
            klass={klass!}
            level={state.level}
            state={state}
            subclassId={
              state.choices.find((pick) => pick.choiceId === `class:${state.classId}:subclass`)
                ?.values[0]
            }
          />
        );
      case "spells":
        return <ClassSpellsStep state={state} set={set} showErrors={submitted} />;
      case "wildShape":
        return (
          <WildShapeFormsPicker
            level={state.level}
            value={state.wildShapeForms}
            onChange={(ids) => set("wildShapeForms", ids)}
          />
        );
      case "masteries":
        return (
          <section className="bg-card rounded-xl border p-4">
            <WeaponMasteryPicker
              classId={state.classId}
              level={state.level}
              weapons={carriedWeapons}
              fromKit
              value={state.weaponMasteries}
              onChange={(keys) => set("weaponMasteries", keys)}
            />
          </section>
        );
      case "expertise":
        return (
          <section className="bg-card rounded-xl border p-4">
            <SkillRows
              def={{
                id: "class:expertise",
                source: "class",
                kind: "skill",
                label: "Expertise",
                count: skillExpertiseCount(state.classId, state.level),
                pool: { kind: "list", values: railSkills },
              }}
              pool={railSkills}
              values={state.skillExpertise}
              onChange={(values) => set("skillExpertise", values as Skill[])}
              catalogs={catalogs}
              scores={derived?.adjustedAbilityScores}
              proficiencyBonus={(derived?.proficiencyBonus ?? 2) * 2}
            />
          </section>
        );
      case "speciesTraits":
        return (
          <SpeciesTraitsStep
            species={species!}
            lineage={fromChoices.speciesChoice}
            size={fromChoices.size as CreatureSize | undefined}
            derived={derived}
          />
        );
      case "alignment":
        return (
          <AlignmentGrid value={state.alignment} onChange={(value) => set("alignment", value)} />
        );
      case "languages":
        return <LanguagePicker state={state} set={set} showErrors={submitted} />;
      case "lore":
        return <LoreStep state={state} set={set} />;
      case "method":
        return <MethodStep method={method} onChange={changeMethod} onConfirm={goNext} />;
      case "values":
        return (
          <ValuesStep
            state={state}
            set={set}
            klass={klass}
            method={method}
            rolled={rolled}
            setRolled={setRolled}
          />
        );
      case "bonus":
        return <BonusStep state={state} set={set} klass={klass} background={background} />;
      case "hitPoints":
        return (
          <HitPointRollsField
            hitDie={klass?.hitDie ?? 8}
            conModifier={derived?.abilityModifiers.con ?? 0}
            levels={Array.from({ length: state.level - 1 }, (_, index) => index + 2)}
            rolls={state.hitPointRolls}
            onChange={(rolls) => set("hitPointRolls", rolls)}
          />
        );
      case "recap":
        return klass ? <RecapStep derived={derived} klass={klass} level={state.level} /> : null;
      case "kit":
        return (
          <KitStep
            kit={{ ...kit, armors: kitArmors }}
            purseCp={kitPurseCp(kit)}
            packages={allDefs
              .filter((def) => def.id.endsWith(":equipment"))
              .flatMap((def) =>
                (state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []).map(
                  (value) => labelOf(def, value),
                ),
              )}
          />
        );
      case "shop":
        return <StepShop state={state} set={set} kit={kit} catalogs={catalogs} />;
      case "review":
        if (!klass) return null;
        {
          const todo = review();
          return (
            <CreationReview
              // The sheet as it will be saved (packages merged, derived block computed).
              preview={
                block
                  ? previewDnd2024Character(formStateToInput(stateForSave(state)), draftId ?? "new")
                  : null
              }
              todo={todo}
              todoBlocks={new Set(todo.map(todoBlock))}
              onEditTodo={(entry) => {
                setFromReview(true);
                gotoKey(entry.stepIndex, entry.key);
              }}
              onEditBlock={(target) => {
                const [stepId, key] = editTarget(target);
                const index = stepOf(stepId);
                if (index < 0) return;
                setFromReview(true);
                gotoKey(index, key);
              }}
            />
          );
        }
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <WizardRail
        steps={steps}
        heading={rebuild ? t(`rebuildHeadings.${rebuild}`) : undefined}
        footer={
          rebuild ? (
            <Button type="button" variant="ghost" onClick={cancel}>
              {t("quit")}
            </Button>
          ) : undefined
        }
        stepIndex={stepIndex}
        subIndex={safeSub}
        substeps={railSubsteps}
        pending={step.entity && !entityIdOf(step.entity, state) ? pendingLabel(step) : undefined}
        stepValue={stepValue}
        stepDone={(index) =>
          index < stepIndex ||
          (seen.has(`${index}:${subsOf(index)[0]?.key}`) &&
            subsOf(index).every((entry) => issuesOf(index, entry).length === 0) &&
            !(steps[index].entity && !entityIdOf(steps[index].entity!, state)))
        }
        stepReachable={(index) => reachable(index, 0)}
        onGoto={goto}
        state={state}
        derived={derived}
        klass={klass}
        species={species}
        skills={railSkills}
        feats={railFeats}
        languages={railLanguages}
        onSaveDraft={saveDraft}
        onCancel={cancel}
        saving={saving}
        savedAt={savedAt}
        guest={guest}
      />

      <WizardScreen
        eyebrow={t("eyebrow", {
          number: stepNumber,
          step: step.label,
          current: safeSub + 1,
          total: subs.length,
        })}
        segments={railSubsteps.map((entry) => ({ key: entry.sub.key, done: entry.done }))}
        current={safeSub}
        title={sub.title}
        lead={sub.lead}
        headerExtra={
          sub.kind === "pick" &&
          step.entity === "class" && (
            <ClassFilterSelect value={classFilter} onChange={setClassFilter} />
          )
        }
        wide={sub.wide}
        fill={sub.kind === "pick"}
        aside={
          contextEntity?.id &&
          contextEntity.name && (
            <div className="bg-card flex items-center gap-3 rounded-xl border p-2.5">
              <EntityPortrait
                id={contextEntity.id}
                name={contextEntity.name}
                imageUrl={contextImage}
                className="size-11"
              />
              <div className="min-w-0 flex-1">
                <span className="font-medium block truncate">{contextEntity.name}</span>
                <span className="text-muted-foreground text-xs">
                  {step.entity ? step.label : t("classLabel")}
                </span>
              </div>
              {step.entity && (
                <Button type="button" size="sm" variant="ghost" onClick={() => goto(stepIndex, 0)}>
                  <PencilIcon /> {t("change")}
                </Button>
              )}
            </div>
          )
        }
        why={sub.why}
        whyTitle={sub.whyTitle}
        issues={looseIssues.map((issue) => issue.message)}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 && safeSub === 0}
            >
              <ChevronLeftIcon /> {t("previous")}
            </Button>
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              // From a large screen up, the rail carries it under the draft button.
              className="lg:hidden"
            >
              {t("cancel")}
            </Button>
            {!rebuild && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={saveDraft}
                disabled={saving}
                aria-label={guest ? t("guestSave") : t("saveDraft")}
                className="lg:hidden"
              >
                <SaveIcon />
              </Button>
            )}
            {fromReview && sub.key !== "review" && (
              <Button type="button" variant="outline" onClick={backToReview} disabled={saving}>
                <ListChecksIcon /> {t("backToReview")}
              </Button>
            )}
            {isLast ? (
              <Button type="button" onClick={finish} disabled={saving}>
                <CheckIcon /> {saving ? t("saving") : rebuild ? t("apply") : t("validate")}
              </Button>
            ) : sub.kind === "pick" && !entityIdOf(step.entity!, state) ? null : (
              <Button type="button" onClick={goNext} disabled={saving}>
                {skippable ? t("skip") : t("next")}
                {nextLabel && (
                  <span className="font-normal opacity-75 max-sm:hidden">· {nextLabel}</span>
                )}
                <ChevronRightIcon />
              </Button>
            )}
          </>
        }
      >
        {body}
      </WizardScreen>

      {original && (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t("confirmTitle", { name: state.name || t("theSheet") })}</DialogTitle>
              <DialogDescription>{t("confirmText")}</DialogDescription>
            </DialogHeader>
            <div className="@container">
              <ImpactStep impact={currentImpact()} upcoming={[]} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                {t("back")}
              </Button>
              <Button type="button" onClick={finish} disabled={saving}>
                <CheckIcon /> {saving ? t("saving") : t("applyShort")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * The starting armour is worn, not carried: the first body armour and the
 * first shield of the packages are equipped, so the AC the wizard shows is the
 * one the sheet will have.
 */
function equipStartingArmor(armors: ItemDraft[]): ItemDraft[] {
  let body = false;
  let shield = false;
  return armors.map((item) => {
    if (!item.armor) return item;
    const isShield = item.armor.category === "shield";
    if (isShield ? shield : body) return item;
    if (isShield) shield = true;
    else body = true;
    return { ...item, armor: { ...item.armor, equipped: true } };
  });
}
