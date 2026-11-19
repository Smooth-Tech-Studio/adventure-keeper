import type { ChoiceSource } from "@adventure-keeper/system-dnd2024";
import { tr } from "@/i18n";

/** The entity a step picks from a grid of cards, if any. */
export type CreationEntity = "class" | "species" | "background";

export type CreationStepId = CreationEntity | "abilities" | "shop";

/**
 * The five creation steps, described as data.
 *
 * Steps 1–3 are generic: a grid of cards, then whatever `resolveChoices()` opens
 * for those sources, then a few plain fields. Steps 4 and 5 are deliberately not
 * generic — assigning ability scores and shopping are their own interactions —
 * and name a dedicated component instead; step 4 still renders the level
 * choices above its table.
 */
export interface CreationStepDef {
  id: CreationStepId;
  /** Short label for the step bar. */
  label: string;
  /** Heading shown above the step. */
  title: string;
  /** One line telling the player what this step is for. */
  description: string;
  /** Entity picked as a card grid. */
  entity?: CreationEntity;
  /**
   * Which `ChoiceDef`s this step renders, read through `choiceStep()` so a
   * feat's own picks land on the step that granted the feat. Every source must
   * appear on exactly one step, or a choice becomes unreachable — the test
   * `steps cover every choice source` holds that line.
   */
  sources?: ChoiceSource[];
  /** Rendered by its own component rather than by the generic step view. */
  custom?: "abilities" | "shop";
}

/** A step whose texts (`wizard:steps.<id>`) are read when accessed: they follow the language. */
function step(
  id: CreationStepId,
  rest: Omit<CreationStepDef, "id" | "label" | "title" | "description">,
): CreationStepDef {
  return {
    id,
    ...rest,
    get label() {
      return tr(`wizard:steps.${id}.label`);
    },
    get title() {
      return tr(`wizard:steps.${id}.title`);
    },
    get description() {
      return tr(`wizard:steps.${id}.description`);
    },
  };
}

export const CREATION_STEPS: CreationStepDef[] = [
  step("class", { entity: "class", sources: ["class", "subclass"] }),
  step("species", { entity: "species", sources: ["species"] }),
  step("background", { entity: "background", sources: ["background"] }),
  // Tier feats (« Amélioration de caractéristique » and friends) are a level
  // choice, and this is the step about levelling up.
  step("abilities", { custom: "abilities", sources: ["level"] }),
  step("shop", { custom: "shop" }),
];

export function stepIndex(id: CreationStepId): number {
  return CREATION_STEPS.findIndex((step) => step.id === id);
}

/** 1-based, as stored on a draft's `creationStep`. */
export function stepNumber(id: CreationStepId): number {
  return stepIndex(id) + 1;
}

export function stepAt(number: number): CreationStepDef {
  const index = Math.min(CREATION_STEPS.length, Math.max(1, Math.round(number))) - 1;
  return CREATION_STEPS[index];
}

/**
 * A finished sheet changing its species, class or background: that step alone
 * — the rest of the sheet, its equipment included, stays as it is.
 */
export function rebuildSteps(target: CreationEntity): CreationStepDef[] {
  return CREATION_STEPS.filter((step) => step.entity === target);
}

/** Where a rebuild finds what a new class or background asks of the scores. */
export const ABILITIES_STEP = CREATION_STEPS[stepIndex("abilities")]!;
