/**
 * Assembling every choice a character faces, from the data in the other modules.
 *
 * `resolveChoices()` is the pivot of the guided creation: it takes the class,
 * species, background, level and the picks made so far, and returns the full
 * list of {@link ChoiceDef}s that are open. The wizard renders them step by step;
 * a later level-up flow will call the same function with a higher `level` and
 * show what it adds.
 *
 * Some choices only exist once an earlier one is made — the Bard's instrument
 * rides on the starting-equipment package, a feat's own picks appear once the
 * feat is granted — so the picks are an input, not just an output.
 *
 * ## What this does *not* cover, on purpose
 *
 * **Ability *allocations* are not choices.** « Répartissez +2/+1 » has no fixed
 * pool to pick from, so a `ChoiceDef` cannot express it. Two of them stay
 * dedicated fields:
 *
 * - the background's +2/+1 (or +1/+1/+1) spread — `backgroundAbilityBonuses`,
 *   validated by `validateBackgroundBonuses`.
 *
 * The increase behind « Amélioration de caractéristique » *is* a choice, though:
 * the slot at each of {@link asiLevels} is a plain general-feat pick — raising
 * your scores is itself a feat in 2024 — and taking that feat opens a second
 * pick, two abilities with repeats allowed (+1/+1, or the same one twice for
 * +2). {@link abilityScoreImprovements} adds them up for the engine.
 */

import { getBackground } from "./backgrounds";
import {
  choiceStep,
  isChoiceOpen,
  type ChoiceDef,
  type ChoicePick,
  choiceValue,
  choiceValues,
  proficiencyValuesOfKind,
} from "./choices";
import { SKILLS, SKILL_LABELS } from "./skills";
import { getClass, hasInvocations } from "./classes";
import { classOptionChoiceDefs } from "./class-options";
import type { Ability } from "./abilities";
import {
  fightingStyleLevel,
  featChoices,
  featsAvailableAt,
  featsOfCategory,
  getFeat,
  hasFightingStyle,
} from "./feats";
import { EPIC_BOON_LEVEL, asiLevelsUpTo } from "./progression";
import { SPECIES_SPELL_ABILITIES, getSpecies, speciesHasSizeChoice, speciesSizes } from "./species";
import {
  backgroundStartingEquipment,
  classStartingEquipment,
  startingEquipmentChoice,
  startingEquipmentChoices,
} from "./starting-equipment";
import { subclassChoice, subclassSpellChoice } from "./subclasses";
import { validInvocations, type InvocationPick } from "./invocations";
import { pick } from "./locale";

export interface ResolveChoicesInput {
  classId?: string;
  speciesId?: string;
  backgroundId?: string;
  /** Defaults to 1. */
  level?: number;
  /** What the player has settled on so far — gates the dependent choices. */
  picks?: readonly ChoicePick[];
  /** Warlock « Manifestations occultes » taken: some open a choice (a feat to pick). */
  invocations?: readonly (InvocationPick | string)[];
}

/** The invocation that grants an origin feat — once per time it is taken. */
export const FIRST_ONES_INVOCATION_ID = "lessons-of-the-first-ones";

/** The choice of the origin feat behind the `nth` « Enseignement des Premiers-Nés ». */
export const firstOnesChoiceId = (nth: number) =>
  `invocation:${FIRST_ONES_INVOCATION_ID}:feat${nth > 1 ? `#${nth}` : ""}`;

/** How many times the character holds « Enseignement des Premiers-Nés ». */
function firstOnesCount(input: ResolveChoicesInput): number {
  if (!hasInvocations(input.classId ?? "") || !input.invocations) return 0;
  const level = Math.max(1, Math.round(input.level ?? 1));
  return validInvocations(input.invocations, level).filter(
    (pick) => pick.id === FIRST_ONES_INVOCATION_ID,
  ).length;
}

/** One origin-feat pick per « Enseignement des Premiers-Nés » held. */
function invocationChoices(input: ResolveChoicesInput): ChoiceDef[] {
  return Array.from({ length: firstOnesCount(input) }, (_, index) => ({
    id: firstOnesChoiceId(index + 1),
    source: "class" as const,
    kind: "option" as const,
    label: pick({
      fr: "Enseignement des Premiers-Nés — don d'origine",
      en: "Lessons of the First Ones — origin feat",
    }),
    count: 1,
    pool: { kind: "list" as const, values: featsOfCategory("origin").map((feat) => feat.id) },
    hint: ORIGIN_FEAT_HINT(),
  }));
}

const ORIGIN_FEAT_HINT = () =>
  pick({
    fr: "Un don d'origine au choix — il peut lui-même ouvrir d'autres choix.",
    en: "An origin feat of your choice — it may open further choices of its own.",
  });

// ===========================================================================
// Per-source builders
// ===========================================================================

function classChoices(input: ResolveChoicesInput): ChoiceDef[] {
  const classId = input.classId;
  const klass = classId ? getClass(classId) : undefined;
  if (!classId || !klass) return [];

  const defs: ChoiceDef[] = [
    {
      id: `class:${classId}:skills`,
      source: "class",
      kind: "skill",
      label: pick({ fr: `Compétences de ${klass.name.toLowerCase()}`, en: `${klass.name} skills` }),
      count: klass.skillChoices.count,
      pool: { kind: "list", values: klass.skillChoices.from },
    },
  ];

  if (klass.toolChoice) {
    defs.push({
      id: `class:${classId}:tool`,
      source: "class",
      kind: "tool",
      label: pick({ fr: "Maîtrise d'outil", en: "Tool proficiency" }),
      count: klass.toolChoice.count,
      pool: { kind: "group", group: klass.toolChoice.from },
    });
  }

  if (fightingStyleLevel(classId) !== undefined) {
    defs.push({
      id: `class:${classId}:fighting-style`,
      source: "class",
      kind: "option",
      label: pick({ fr: "Style de combat", en: "Fighting style" }),
      count: 1,
      pool: {
        kind: "list",
        values: featsOfCategory("fightingStyle").map((feat) => feat.id),
      },
      minLevel: fightingStyleLevel(classId),
    });
  }

  // « Au choix » of the class table: Ordre primitif, Ordre divin, Impacts bénis…
  defs.push(...classOptionChoiceDefs(classId));

  // One more skill from the class list (the Barbarian's « Savoir primal »).
  const bonusSkill = klass.bonusSkill;
  if (bonusSkill) {
    defs.push({
      id: `class:${classId}:${bonusSkill.id}`,
      source: "class",
      kind: "skill",
      label: bonusSkill.label,
      count: 1,
      pool: { kind: "list", values: klass.skillChoices.from },
      minLevel: bonusSkill.minLevel,
      hint: bonusSkill.hint,
    });
  }

  const subclass = subclassChoice(classId);
  if (subclass) defs.push(subclass);
  const subclassId = choiceValue(input.picks, `class:${classId}:subclass`);
  const subclassSpells = subclassId ? subclassSpellChoice(classId, subclassId) : undefined;
  if (subclassSpells) defs.push(subclassSpells);

  const equipment = classStartingEquipment(classId);
  if (equipment) {
    const choice = startingEquipmentChoice(equipment);
    defs.push(choice, ...startingEquipmentChoices(equipment, choiceValue(input.picks, choice.id)));
  }

  return defs;
}

function speciesChoices(input: ResolveChoicesInput): ChoiceDef[] {
  const speciesId = input.speciesId;
  const species = speciesId ? getSpecies(speciesId) : undefined;
  if (!speciesId || !species) return [];

  const defs: ChoiceDef[] = [];

  if (species.choice) {
    defs.push({
      id: `species:${speciesId}:lineage`,
      source: "species",
      kind: "option",
      label: species.choice.label,
      count: 1,
      pool: { kind: "list", values: species.choice.options },
    });
  }

  if (speciesHasSizeChoice(speciesId)) {
    defs.push({
      id: `species:${speciesId}:size`,
      source: "species",
      kind: "option",
      label: pick({ fr: "Taille", en: "Size" }),
      count: 1,
      pool: { kind: "list", values: speciesSizes(speciesId) },
    });
  }

  if (species.skillGrant) {
    const { trait, count, from } = species.skillGrant;
    defs.push({
      id: `species:${speciesId}:skill`,
      source: "species",
      kind: "skill",
      label: trait,
      count,
      pool: from === "any" ? { kind: "any" } : { kind: "list", values: from },
    });
  }

  if (species.originFeatGrant) {
    defs.push({
      id: `species:${speciesId}:origin-feat`,
      source: "species",
      kind: "option",
      label: species.originFeatGrant.trait,
      count: 1,
      pool: { kind: "list", values: featsOfCategory("origin").map((feat) => feat.id) },
      hint: ORIGIN_FEAT_HINT(),
    });
  }

  if (species.spellsUseChosenAbility) {
    defs.push({
      id: `species:${speciesId}:spell-ability`,
      source: "species",
      kind: "ability",
      label: pick({
        fr: "Caractéristique d'incantation de l'espèce",
        en: "Species spellcasting ability",
      }),
      count: 1,
      pool: { kind: "list", values: SPECIES_SPELL_ABILITIES },
      hint: pick({
        fr: "Sert aux sorts que votre espèce vous accorde.",
        en: "Used for the spells your species grants you.",
      }),
    });
  }

  return defs;
}

function backgroundChoices(input: ResolveChoicesInput): ChoiceDef[] {
  const backgroundId = input.backgroundId;
  const background = backgroundId ? getBackground(backgroundId) : undefined;
  if (!backgroundId || !background) return [];

  const defs: ChoiceDef[] = [];

  // A custom background grants nothing outright: each absence below becomes a
  // pick. The sixteen rulebook backgrounds always carry their three grants, so
  // only the tool one — which they may already offer as a choice — shows up.
  if (!background.skillProficiencies) {
    defs.push({
      id: `background:${backgroundId}:skills`,
      source: "background",
      kind: "skill",
      label: pick({ fr: "Compétences de l'historique", en: "Background skills" }),
      count: 2,
      pool: { kind: "any" },
      hint: pick({
        fr: "Deux compétences, celles que votre passé vous a laissées.",
        en: "Two skills, the ones your past left you with.",
      }),
    });
  }

  const tool = background.toolProficiency;
  if (!tool) {
    defs.push({
      id: `background:${backgroundId}:tool`,
      source: "background",
      kind: "tool",
      label: pick({ fr: "Maîtrise d'outil", en: "Tool proficiency" }),
      count: 1,
      pool: { kind: "any" },
      hint: pick({
        fr: "Un outil, un instrument ou une boîte de jeux.",
        en: "A tool, an instrument or a gaming set.",
      }),
    });
  } else if ("choice" in tool) {
    defs.push({
      id: `background:${backgroundId}:tool`,
      source: "background",
      kind: "tool",
      label: tool.label,
      count: 1,
      pool: { kind: "group", group: tool.choice },
    });
  }

  if (!background.originFeatId) {
    defs.push({
      id: `background:${backgroundId}:origin-feat`,
      source: "background",
      kind: "option",
      label: pick({ fr: "Don d'origine", en: "Origin feat" }),
      count: 1,
      pool: { kind: "list", values: featsOfCategory("origin").map((feat) => feat.id) },
      hint: ORIGIN_FEAT_HINT(),
    });
  }

  const equipment = backgroundStartingEquipment(backgroundId);
  if (equipment) {
    const choice = startingEquipmentChoice(equipment);
    defs.push(choice, ...startingEquipmentChoices(equipment, choiceValue(input.picks, choice.id)));
  }

  return defs;
}

function levelChoices(input: ResolveChoicesInput): ChoiceDef[] {
  const classId = input.classId;
  if (!classId) return [];
  const level = Math.max(1, Math.round(input.level ?? 1));

  const defs: ChoiceDef[] = asiLevelsUpTo(classId, level).flatMap((at): ChoiceDef[] => [
    {
      id: `level:${at}:feat`,
      source: "level",
      kind: "option",
      label: pick({
        fr: `Niveau ${at} — amélioration ou don`,
        en: `Level ${at} — improvement or feat`,
      }),
      count: 1,
      pool: { kind: "list", values: featsAvailableAt("general", at).map((feat) => feat.id) },
      minLevel: at,
      hint: pick({
        fr: "« Amélioration de caractéristique » augmente vos valeurs ; tout autre don les laisse en l'état.",
        en: "“Ability Score Improvement” raises your scores; any other feat leaves them as they are.",
      }),
    },
    {
      id: `level:${at}:asi`,
      source: "level",
      kind: "ability",
      label: pick({
        fr: `Niveau ${at} — caractéristiques augmentées`,
        en: `Level ${at} — increased abilities`,
      }),
      count: 2,
      pool: { kind: "any" },
      minLevel: at,
      requires: { choiceId: `level:${at}:feat`, value: ASI_FEAT_ID },
      allowRepeat: true,
      hint: pick({
        fr: "+1 à deux caractéristiques, ou deux fois la même pour +2. Aucune ne dépasse 20.",
        en: "+1 to two abilities, or twice the same one for +2. None goes above 20.",
      }),
    },
  ]);

  if (level >= EPIC_BOON_LEVEL) {
    defs.push({
      id: `level:${EPIC_BOON_LEVEL}:epic-boon`,
      source: "level",
      kind: "option",
      label: pick({
        fr: `Niveau ${EPIC_BOON_LEVEL} — faveur épique`,
        en: `Level ${EPIC_BOON_LEVEL} — epic boon`,
      }),
      count: 1,
      pool: {
        kind: "list",
        values: featsAvailableAt("epic", level).map((feat) => feat.id),
      },
      minLevel: EPIC_BOON_LEVEL,
    });
  }

  return defs;
}

/** A feat the character holds, and the step on which they won it. */
export interface HeldFeat {
  featId: string;
  /** Which step should show the picks this feat brings with it. */
  via: ChoiceDef["source"];
  /** The choice that picked the feat, if it was picked: its own picks come right after. */
  pickedBy?: string;
}

/**
 * The feats the character actually holds, each tagged with where it came from:
 * the background's origin feat, the one a species trait lets you pick (Human
 * « Polyvalent »), the fighting style, and every feat taken at a level slot.
 *
 * The tag is what lets the wizard show a feat's own picks on the step that
 * granted it, rather than stranding them with no step at all.
 */
export function heldFeats(input: ResolveChoicesInput): HeldFeat[] {
  const held: HeldFeat[] = [];

  const backgroundId = input.backgroundId;
  const background = backgroundId ? getBackground(backgroundId) : undefined;
  if (background?.originFeatId) {
    held.push({ featId: background.originFeatId, via: "background" });
  } else if (background && backgroundId) {
    // A custom background's origin feat is a pick, not a grant.
    const pickedBy = `background:${backgroundId}:origin-feat`;
    for (const featId of choiceValues(input.picks, pickedBy)) {
      held.push({ featId, via: "background", pickedBy });
    }
  }

  const speciesId = input.speciesId;
  if (speciesId && getSpecies(speciesId)?.originFeatGrant) {
    const pickedBy = `species:${speciesId}:origin-feat`;
    for (const featId of choiceValues(input.picks, pickedBy)) {
      held.push({ featId, via: "species", pickedBy });
    }
  }

  const classId = input.classId;
  const level = Math.max(1, Math.round(input.level ?? 1));

  if (classId && hasFightingStyle(classId, level)) {
    const pickedBy = `class:${classId}:fighting-style`;
    for (const featId of choiceValues(input.picks, pickedBy)) {
      held.push({ featId, via: "class", pickedBy });
    }
  }

  for (let nth = 1; nth <= firstOnesCount(input); nth += 1) {
    const pickedBy = firstOnesChoiceId(nth);
    for (const featId of choiceValues(input.picks, pickedBy)) {
      held.push({ featId, via: "class", pickedBy });
    }
  }

  if (classId) {
    for (const at of asiLevelsUpTo(classId, level)) {
      const pickedBy = `level:${at}:feat`;
      for (const featId of choiceValues(input.picks, pickedBy)) {
        held.push({ featId, via: "level", pickedBy });
      }
    }
    if (level >= EPIC_BOON_LEVEL) {
      const pickedBy = `level:${EPIC_BOON_LEVEL}:epic-boon`;
      for (const featId of choiceValues(input.picks, pickedBy)) {
        held.push({ featId, via: "level", pickedBy });
      }
    }
  }

  return held;
}

/** The general feat that raises ability scores instead of granting a talent. */
export const ASI_FEAT_ID = "ability-score-improvement";

/** Highest score an ability-score improvement can reach. */
export const ASI_SCORE_CAP = 20;

/**
 * What the « Amélioration de caractéristique » picks add, per ability: +1 for
 * each time an ability is picked, across every improvement level reached. The
 * cap of 20 is applied by the engine, on the final score.
 */
export function abilityScoreImprovements(
  input: ResolveChoicesInput,
): Partial<Record<Ability, number>> {
  const classId = input.classId;
  const out: Partial<Record<Ability, number>> = {};
  if (!classId) return out;
  const level = Math.max(1, Math.round(input.level ?? 1));
  for (const at of asiLevelsUpTo(classId, level)) {
    if (choiceValue(input.picks, `level:${at}:feat`) !== ASI_FEAT_ID) continue;
    for (const ability of choiceValues(input.picks, `level:${at}:asi`).slice(0, 2)) {
      out[ability as Ability] = (out[ability as Ability] ?? 0) + 1;
    }
  }
  return out;
}

/** Just the ids — what the rules engine folds into the derived block. */
export function heldFeatIds(input: ResolveChoicesInput): string[] {
  return heldFeats(input).map((held) => held.featId);
}

// ===========================================================================
// resolveChoices
// ===========================================================================

/** A feat's choice for the `nth` time the feat is held: its own id from the second on. */
function nthFeatChoice(def: ChoiceDef, nth: number, via: ChoiceDef["source"]): ChoiceDef {
  if (nth === 1) return { ...def, via };
  const suffix = (id: string) => `${id}#${nth}`;
  return {
    ...def,
    id: suffix(def.id),
    via,
    // A gate on another pick of the same feat follows it.
    requires:
      def.requires && def.requires.choiceId.startsWith(def.id.split(":").slice(0, 2).join(":"))
        ? { ...def.requires, choiceId: suffix(def.requires.choiceId) }
        : def.requires,
  };
}

/** The choices that pick a feat: a background or species origin feat, a style, a level slot. */
const FEAT_PICK = /:origin-feat$|:fighting-style$|^level:\d+:(feat|epic-boon)$|^invocation:/;

/**
 * Takes out of each feat list the feats held through another pick that may not
 * be taken twice. The pick that holds a feat keeps it in its own list.
 */
function withoutHeldFeats(defs: ChoiceDef[], held: HeldFeat[]): ChoiceDef[] {
  return defs.map((def) => {
    if (!FEAT_PICK.test(def.id) || def.pool.kind !== "list") return def;
    const elsewhere = new Set(
      held
        .filter((entry) => entry.pickedBy !== def.id && !getFeat(entry.featId)?.repeatable)
        .map((entry) => entry.featId),
    );
    if (elsewhere.size === 0) return def;
    return {
      ...def,
      pool: { ...def.pool, values: def.pool.values.filter((id) => !elsewhere.has(id)) },
    };
  });
}

/**
 * Every choice open to this character, in creation order: class, then species,
 * then background, then the picks the chosen feats bring with them.
 *
 * A choice gated by `minLevel` or `requires` is filtered out until it opens, so
 * the caller can render the result as-is.
 */
export function resolveChoices(input: ResolveChoicesInput): ChoiceDef[] {
  const level = Math.max(1, Math.round(input.level ?? 1));
  const picks = input.picks;

  const defs = [
    ...classChoices(input),
    ...speciesChoices(input),
    ...backgroundChoices(input),
    ...levelChoices(input),
    ...invocationChoices(input),
  ];
  // A feat's own picks are shown on the step that granted the feat, right
  // after the choice that picked it (Doué's three proficiencies follow « Doué »);
  // a feat the background grants outright opens that step.
  const held = heldFeats(input);
  // How many times each feat is held: a repeatable feat taken again brings its
  // picks again, under ids of their own (Doué twice: 6 proficiencies, not 3).
  const times = new Map<string, number>();
  for (const entry of held) {
    const nth = (times.get(entry.featId) ?? 0) + 1;
    times.set(entry.featId, nth);
    const own = featChoices([entry.featId]).map((def) => nthFeatChoice(def, nth, entry.via));
    const after = entry.pickedBy ? defs.findIndex((def) => def.id === entry.pickedBy) : -1;
    const first = defs.findIndex((def) => choiceStep(def) === entry.via);
    const at = after >= 0 ? after + 1 : first >= 0 ? first : defs.length;
    defs.splice(at, 0, ...own);
  }
  defs.push(...skillSwapChoices(input, defs));

  // A feat that cannot be taken twice leaves the other feat lists once held.
  const pools = withoutHeldFeats(defs, held);

  // De-duplicate: the same choice reached twice must show once.
  const seen = new Set<string>();
  return pools.filter((def) => {
    if (seen.has(def.id)) return false;
    seen.add(def.id);
    return isChoiceOpen(def, level, picks);
  });
}

/**
 * A background skill the character already masters through another pick (the
 * class's, the species', a feat's) is replaced by another skill of the player's
 * choice — one per skill granted twice.
 */
function skillSwapChoices(input: ResolveChoicesInput, defs: readonly ChoiceDef[]): ChoiceDef[] {
  const background = input.backgroundId ? getBackground(input.backgroundId) : undefined;
  if (!input.backgroundId || !background?.skillProficiencies) return [];
  // Each skill picked elsewhere, with the name of what gave it (« Roublard »).
  const sourceName = (def: ChoiceDef): string => {
    if (def.source === "class") return getClass(input.classId ?? "")?.name ?? def.label;
    if (def.source === "species") return getSpecies(input.speciesId ?? "")?.name ?? def.label;
    if (def.source === "feat") return getFeat(def.id.split(":")[1])?.name ?? def.label;
    return def.label;
  };
  const picked = new Map<string, string>();
  for (const def of defs) {
    const values = choiceValues(input.picks, def.id);
    const skills =
      def.kind === "skill"
        ? values
        : def.kind === "proficiency"
          ? proficiencyValuesOfKind(values, "skill")
          : [];
    for (const skill of skills) if (!picked.has(skill)) picked.set(skill, sourceName(def));
  }
  const twice = background.skillProficiencies.filter((skill) => picked.has(skill));
  if (twice.length === 0) return [];
  const taken = new Set([...picked.keys(), ...background.skillProficiencies]);
  const list = (word: string) =>
    twice.map((skill) => `${SKILL_LABELS[skill]} (${word} ${picked.get(skill)})`).join(", ");
  return [
    {
      id: `background:${input.backgroundId}:skill-swap`,
      source: "background",
      kind: "skill",
      label: pick({ fr: "Compétence de remplacement", en: "Replacement skill" }),
      count: twice.length,
      pool: { kind: "list", values: SKILLS.filter((skill) => !taken.has(skill)) },
      hint: pick({
        fr: `Votre historique (${background.name}) donne une compétence que vous maîtrisez déjà : ${list("grâce à")}. Choisissez-en une autre à la place.`,
        en: `Your background (${background.name}) gives a skill you already have: ${list("from")}. Pick another one instead.`,
      }),
    },
  ];
}

/** The open choices of one source — what a wizard step renders. */
export function resolveChoicesFor(
  input: ResolveChoicesInput,
  source: ChoiceDef["source"],
): ChoiceDef[] {
  return resolveChoices(input).filter((def) => def.source === source);
}
