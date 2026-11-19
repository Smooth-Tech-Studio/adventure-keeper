/**
 * Every {@link Mechanic} a character carries, gathered from where they live:
 * the base-class features reached, the subclass's, the species traits, the
 * feats held and the class options picked (Ordre primitif…). Each comes with
 * the name of its feature, for the sheet and the roll sheet to say why.
 */

import { choiceValue, type ChoicePick } from "./choices";
import { classOptionChoiceId, classOptionChoices, getClassOption } from "./class-options";
import { getFeat } from "./feats";
import { classFeatures, speciesFeatures } from "./features";
import type { SourcedMechanic } from "./mechanics";
import { subclassFeatures } from "./subclasses";

export interface CollectMechanicsInput {
  classId: string;
  level: number;
  subclassId?: string | null;
  speciesId?: string;
  featIds?: readonly string[];
  picks?: readonly ChoicePick[];
}

export function collectMechanics(input: CollectMechanicsInput): SourcedMechanic[] {
  const out: SourcedMechanic[] = [];
  const add = (source: string, mechanics: readonly SourcedMechanic["mechanic"][] | undefined) => {
    for (const mechanic of mechanics ?? []) out.push({ mechanic, source });
  };

  for (const feature of classFeatures(input.classId, input.level)) {
    add(feature.name, feature.mechanics);
  }
  if (input.subclassId) {
    for (const feature of subclassFeatures(input.subclassId, input.level)) {
      add(feature.name, feature.mechanics);
    }
  }
  if (input.speciesId) {
    for (const trait of speciesFeatures(input.speciesId)) add(trait.name, trait.mechanics);
  }
  for (const id of input.featIds ?? []) {
    const feat = getFeat(id);
    if (feat) add(feat.name, feat.mechanics);
  }
  for (const choice of classOptionChoices(input.classId)) {
    if (input.level < choice.level) continue;
    const option = getClassOption(choiceValue(input.picks, classOptionChoiceId(choice)) ?? "");
    if (option) add(`${choice.label} (${option.name})`, option.mechanics);
  }
  return out;
}

/**
 * Cantrips known beyond the class table (Ordre primitif : Magicien, Ordre
 * divin : Thaumaturge) — for the spell pickers, before the sheet is derived.
 */
export function bonusCantripsFor(input: CollectMechanicsInput): number {
  return collectMechanics(input).reduce(
    (total, { mechanic }) =>
      mechanic.type === "extraCantrips" &&
      (mechanic.minLevel === undefined || input.level >= mechanic.minLevel)
        ? total + mechanic.count
        : total,
    0,
  );
}
