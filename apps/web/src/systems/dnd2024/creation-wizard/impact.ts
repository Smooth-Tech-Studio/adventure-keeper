import {
  SKILL_LABELS,
  classFeatures,
  formatDistance,
  getBackground,
  getClass,
  getFeat,
  getLanguage,
  getSpecies,
  grantedLanguages,
  speciesFeatures,
  type CharacterDerived,
} from "@adventure-keeper/system-dnd2024";

import type { FormState } from "@/systems/dnd2024/character-form/state";
import { tr } from "@/i18n";

/**
 * What a change of species, class or background does to a finished sheet:
 * what leaves it, what it gains on its own, and the numbers that move. Built
 * by comparing the sheet before and after, so it holds for any pair of
 * origins, packs included — nothing here is written for one species.
 */

export interface ImpactLine {
  label: string;
  detail?: string;
}

export interface OriginImpact {
  lost: ImpactLine[];
  gained: ImpactLine[];
  kept: ImpactLine[];
  /** `[label, before, after]`, only the ones that differ. */
  numbers: [string, string, string][];
}

/** `a` minus `b`, by key. */
function minus<T>(a: T[], b: T[], key: (item: T) => string): T[] {
  const other = new Set(b.map(key));
  return a.filter((item) => !other.has(key(item)));
}

/** Everything the sheet holds that a change of origin can take away or bring. */
function holdings(
  state: FormState,
  derived: CharacterDerived | null,
  spellName: (id: string) => string,
): ImpactLine[] {
  const species = getSpecies(state.speciesId);
  const lines: ImpactLine[] = [
    ...speciesFeatures(state.speciesId).map((feature) => ({
      label: feature.name,
      detail: species
        ? tr("wizard:impact.trait", { species: species.name })
        : tr("wizard:impact.speciesTrait"),
    })),
    ...(state.classId ? classFeatures(state.classId, state.level) : []).map((feature) => ({
      label: feature.name,
      detail: tr("wizard:impact.feature", { class: getClass(state.classId)?.name ?? "" }),
    })),
    ...(derived?.featIds ?? []).map((id) => ({
      label: getFeat(id)?.name ?? id,
      detail: tr("wizard:impact.feat"),
    })),
    ...(derived?.proficientSkills ?? []).map((skill) => ({
      label: SKILL_LABELS[skill],
      detail: tr("wizard:impact.skill"),
    })),
    ...[...state.cantrips, ...state.spells, ...(derived?.grantedSpells ?? []).map((g) => g.spellId)]
      .filter((id, index, all) => all.indexOf(id) === index)
      .map((id) => ({ label: spellName(id), detail: tr("wizard:impact.spell") })),
    ...grantedLanguages({
      speciesId: state.speciesId || undefined,
      classId: state.classId || undefined,
    }).map((entry) => ({
      label: getLanguage(entry.id)?.name ?? entry.id,
      detail: tr("wizard:impact.language"),
    })),
  ];
  return lines;
}

export function originImpact(
  before: FormState,
  after: FormState,
  beforeDerived: CharacterDerived | null,
  afterDerived: CharacterDerived | null,
  spellName: (id: string) => string,
): OriginImpact {
  const key = (line: ImpactLine) => `${line.detail?.split(" · ")[0]}:${line.label}`;
  const was = holdings(before, beforeDerived, spellName);
  const now = holdings(after, afterDerived, spellName);

  const kept: ImpactLine[] = [];
  const entity = (label: string, from: string | undefined, to: string | undefined) => {
    if (from === to) kept.push({ label, detail: from });
  };
  entity(tr("wizard:impact.class"), getClass(before.classId)?.name, getClass(after.classId)?.name);
  entity(
    tr("wizard:impact.species"),
    getSpecies(before.speciesId)?.name,
    getSpecies(after.speciesId)?.name,
  );
  entity(
    tr("wizard:impact.background"),
    getBackground(before.backgroundId)?.name,
    getBackground(after.backgroundId)?.name,
  );
  kept.push(
    { label: tr("wizard:impact.level"), detail: String(after.level) },
    { label: tr("wizard:impact.scores") },
    { label: tr("wizard:impact.equipment") },
    { label: tr("wizard:impact.identity") },
  );

  const numbers: [string, string, string][] = [];
  if (beforeDerived && afterDerived) {
    const row = (label: string, from: string, to: string) => {
      if (from !== to) numbers.push([label, from, to]);
    };
    row(
      tr("wizard:impact.maxHp"),
      String(beforeDerived.maxHitPoints),
      String(afterDerived.maxHitPoints),
    );
    row(tr("wizard:impact.ac"), String(beforeDerived.armorClass), String(afterDerived.armorClass));
    row(
      tr("wizard:impact.speed"),
      formatDistance(beforeDerived.speed),
      formatDistance(afterDerived.speed),
    );
    const vision = (feet: number) => (feet > 0 ? formatDistance(feet) : tr("wizard:impact.none"));
    row(
      tr("wizard:impact.darkvision"),
      vision(beforeDerived.darkvision),
      vision(afterDerived.darkvision),
    );
    row(
      tr("wizard:impact.passivePerception"),
      String(beforeDerived.passivePerception),
      String(afterDerived.passivePerception),
    );
    row(
      tr("wizard:impact.spellDc"),
      String(beforeDerived.spellSaveDc ?? "—"),
      String(afterDerived.spellSaveDc ?? "—"),
    );
  }

  return {
    lost: minus(was, now, key),
    gained: minus(now, was, key),
    kept,
    numbers,
  };
}
