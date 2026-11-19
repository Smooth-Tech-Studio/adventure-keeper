/**
 * Projecting resolved choices onto the fields the rules engine reads.
 *
 * The sheet carries two representations of the same decisions:
 *
 * - **dedicated fields** (`skillProficiencies`, `speciesChoice`, `size`…), which
 *   every sheet written before the guided creation uses, and which
 *   `computeCharacterDerived` has always read;
 * - **`choices`**, the generic {@link ChoicePick} list the wizard records.
 *
 * `choiceDerivedInput()` turns the second into the first so the engine has one
 * view, whichever the sheet uses. Merging is **additive**: a sheet with no
 * choices comes out exactly as it went in, which is what keeps old sheets
 * deriving the same block as before.
 *
 * The mapping is driven by the choice's `kind` and `source`, not by a table of
 * ids — a new class skill choice needs no change here. Three choices carry a
 * value with nowhere else to go (lineage, size, species casting ability) and are
 * recognised by an id suffix; those suffixes are set in `resolve-choices.ts`.
 */

import { choiceValues, proficiencyValuesOfKind, type ChoiceDef, type ChoicePick } from "./choices";

/** The engine-facing shape a set of picks produces. */
export interface ChoiceDerivedInput {
  /** Skill proficiencies from the class list, a feat or a level slot. */
  skillProficiencies: string[];
  /** Skill proficiencies from a species trait — kept apart, as on the sheet. */
  speciesSkillProficiencies: string[];
  /** Tool proficiencies, whatever granted them (catalogue ids). */
  toolProficiencies: string[];
  /** In-species choice: elven lineage, draconic ancestry, fiendish legacy. */
  speciesChoice?: string;
  /** Size, for a species that offers one. */
  size?: string;
  /** Ability the species-granted spells are cast with. */
  speciesSpellAbility?: string;
}

const EMPTY: ChoiceDerivedInput = {
  skillProficiencies: [],
  speciesSkillProficiencies: [],
  toolProficiencies: [],
};

/** Suffixes of the choices whose value maps to a named field. */
const LINEAGE_SUFFIX = ":lineage";
const SIZE_SUFFIX = ":size";
const SPELL_ABILITY_SUFFIX = ":spell-ability";

/**
 * What a set of picks contributes to the engine's input. Pass the choices that
 * `resolveChoices()` opened, so a pick left over from an abandoned class is
 * ignored rather than applied.
 */
export function choiceDerivedInput(
  defs: readonly ChoiceDef[],
  picks: readonly ChoicePick[] | null | undefined,
): ChoiceDerivedInput {
  if (!picks || picks.length === 0) return { ...EMPTY };

  const out: ChoiceDerivedInput = {
    skillProficiencies: [],
    speciesSkillProficiencies: [],
    toolProficiencies: [],
  };

  for (const def of defs) {
    const values = choiceValues(picks, def.id);
    if (values.length === 0) continue;

    switch (def.kind) {
      case "skill":
        if (def.source === "species") out.speciesSkillProficiencies.push(...values);
        else out.skillProficiencies.push(...values);
        break;

      case "tool":
        out.toolProficiencies.push(...values);
        break;

      // « 3 maîtrises, compétences et outils mélangés » (Doué) splits in two.
      case "proficiency":
        out.skillProficiencies.push(...proficiencyValuesOfKind(values, "skill"));
        out.toolProficiencies.push(...proficiencyValuesOfKind(values, "tool"));
        break;

      case "option":
        if (def.id.endsWith(LINEAGE_SUFFIX)) out.speciesChoice = values[0];
        else if (def.id.endsWith(SIZE_SUFFIX)) out.size = values[0];
        break;

      case "ability":
        if (def.id.endsWith(SPELL_ABILITY_SUFFIX)) out.speciesSpellAbility = values[0];
        break;

      // Spells and items are stored on the sheet's own lists, not derived here.
      case "spell":
      case "item":
      case "language":
        break;
    }
  }

  out.skillProficiencies = [...new Set(out.skillProficiencies)];
  out.speciesSkillProficiencies = [...new Set(out.speciesSkillProficiencies)];
  out.toolProficiencies = [...new Set(out.toolProficiencies)];
  return out;
}

/** `a` and `b` merged, de-duplicated; a value set on `b` wins a conflict. */
export function mergeChoiceDerivedInput(
  a: Partial<ChoiceDerivedInput>,
  b: ChoiceDerivedInput,
): ChoiceDerivedInput {
  return {
    skillProficiencies: [...new Set([...(a.skillProficiencies ?? []), ...b.skillProficiencies])],
    speciesSkillProficiencies: [
      ...new Set([...(a.speciesSkillProficiencies ?? []), ...b.speciesSkillProficiencies]),
    ],
    toolProficiencies: [...new Set([...(a.toolProficiencies ?? []), ...b.toolProficiencies])],
    speciesChoice: b.speciesChoice ?? a.speciesChoice,
    size: b.size ?? a.size,
    speciesSpellAbility: b.speciesSpellAbility ?? a.speciesSpellAbility,
  };
}

/**
 * The reverse direction: a sheet's dedicated fields read back as picks, so a
 * character written before the wizard can be reopened in it.
 *
 * Only the choices in `defs` are produced — a stored skill that the class no
 * longer offers is dropped, the same way `pruneChoicePicks` drops it.
 */
export function normalizeChoices(
  defs: readonly ChoiceDef[],
  sheet: Partial<ChoiceDerivedInput> & { choices?: readonly ChoicePick[] },
): ChoicePick[] {
  // Anything already recorded as a choice wins: it is the newer representation.
  const existing = new Map((sheet.choices ?? []).map((pick) => [pick.choiceId, pick]));
  const out: ChoicePick[] = [];

  for (const def of defs) {
    const already = existing.get(def.id);
    if (already) {
      out.push(already);
      continue;
    }

    const values = legacyValuesFor(def, sheet);
    if (values.length > 0) out.push({ choiceId: def.id, values: values.slice(0, def.count) });
  }

  return out;
}

function legacyValuesFor(def: ChoiceDef, sheet: Partial<ChoiceDerivedInput>): string[] {
  const inPool = (candidates: readonly string[]) => {
    if (def.pool.kind !== "list") return [...candidates];
    const allowed = new Set(def.pool.values);
    return candidates.filter((value) => allowed.has(value));
  };

  switch (def.kind) {
    case "skill":
      return inPool(
        def.source === "species"
          ? (sheet.speciesSkillProficiencies ?? [])
          : (sheet.skillProficiencies ?? []),
      );
    case "tool":
      return inPool(sheet.toolProficiencies ?? []);
    case "option":
      if (def.id.endsWith(LINEAGE_SUFFIX) && sheet.speciesChoice) {
        return inPool([sheet.speciesChoice]);
      }
      if (def.id.endsWith(SIZE_SUFFIX) && sheet.size) return inPool([sheet.size]);
      return [];
    case "ability":
      if (def.id.endsWith(SPELL_ABILITY_SUFFIX) && sheet.speciesSpellAbility) {
        return inPool([sheet.speciesSpellAbility]);
      }
      return [];
    default:
      return [];
  }
}
