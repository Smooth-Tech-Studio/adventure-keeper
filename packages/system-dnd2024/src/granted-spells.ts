import { z } from "zod";
import { abilitySchema, type Ability, type AbilityModifierBlock } from "./abilities";
import { choiceValue, choiceValues, type ChoicePick } from "./choices";
import { getClass, hasInvocations } from "./classes";
import { getFeat, parseSpellGroup } from "./feats";
import { getInvocation, validInvocations, type InvocationPick } from "./invocations";
import { activeContent } from "./packs/active";
import { getLineage, getSpecies, speciesOptionLabel } from "./species";
import {
  SUBCLASS_LEVEL,
  getSubclass,
  subclassSpellChoiceId,
  subclassSpellGrants,
} from "./subclasses";
import { pick } from "./locale";

/**
 * Spells a class (later: species / feat) grants **always prepared** — the
 * character knows them without spending a preparation slot, and, unless
 * `countsAgainstPrepared`, they sit *on top of* the number of spells the player
 * may prepare from the class list.
 *
 * Five sources are modelled today:
 *   - 2024 base-class chassis:
 *       Druide, aptitude « Druidique » (niv. 1) → *Communication avec les animaux*
 *       Rôdeur, aptitude « Ennemi juré » (niv. 1) → *Marque du chasseur*
 *   - Species: elven lineage (Drow / Haut-elfe / Elfe des bois) and the Tieffelin's
 *     legacy + « Présence d'outre-monde » — a cantrip at level 1, then a spell at
 *     levels 3 and 5.
 *   - Warlock invocations that let you cast a spell at will (Armure d'ombres →
 *     *Armure du mage*, Mille visages → *Déguisement*, …).
 *
 *   - Subclasses: domain, oath, circle, patron and draconic spells, by tier
 *     (the Circle of the Land's from the environment picked).
 *   - Feats: every spell a held feat made the player pick (« Initié à la
 *     magie » : two cantrips and a level-1 spell).
 */

export const grantedSpellSourceSchema = z.enum([
  "class",
  "species",
  "invocation",
  "subclass",
  "feat",
]);
export type GrantedSpellSource = z.infer<typeof grantedSpellSourceSchema>;

export const grantedSpellSchema = z.object({
  /** Spell id, as found in the web app's `spells.json`. */
  spellId: z.string().min(1),
  source: grantedSpellSourceSchema,
  /** The feature / trait the grant comes from, e.g. `"Druidique"`. */
  sourceLabel: z.string(),
  /** Character level at which the grant applies. */
  minLevel: z.number().int(),
  /** `0` for a granted cantrip, `>= 1` for an always-prepared leveled spell. */
  spellLevel: z.number().int(),
  /**
   * When `true`, the spell still occupies one of the class's prepared-spell
   * slots (rare). Default `false`: it does not count against the limit.
   */
  countsAgainstPrepared: z.boolean(),
  /**
   * The ability the spell is cast with, when it is not the class's: the one
   * picked for the feat that granted it (« Initié à la magie »). Absent on
   * sheets saved before it existed, and for every other source.
   */
  ability: abilitySchema.optional(),
});
export type GrantedSpell = z.infer<typeof grantedSpellSchema>;

/** A class grant before its `source: "class"` tag is filled in. */
type ClassGrantSeed = Omit<GrantedSpell, "source">;

/** The spells a class grants, labelled with their feature — or, without one, the class's name. */
function classGrants(classId: string): ClassGrantSeed[] {
  const klass = getClass(classId);
  return (klass?.grantedSpells ?? []).map(({ label, ...grant }) => ({
    ...grant,
    sourceLabel: label ?? klass?.name ?? classId,
    countsAgainstPrepared: false,
  }));
}

export interface GrantedSpellsInput {
  classId: string;
  level?: number;
  /** Species and its choice (lineage / legacy), for the spells they grant. */
  speciesId?: string;
  speciesChoice?: string;
  /** Warlock « Manifestations occultes » picked (ignored for other classes). */
  invocations?: readonly (InvocationPick | string)[];
  /** The character's picks: the subclass, its spell list, the feats' spells. */
  picks?: readonly ChoicePick[];
  /** The feats held (`heldFeatIds`), for the spells they made the player pick. */
  featIds?: readonly string[];
}

/**
 * The spells granted "always prepared" to a character at its level. Pure and
 * data-only — the caller resolves ids against the spell dictionary for display.
 * A spell two sources grant (Druid and Forest Gnome: *Communication avec les
 * animaux*) comes once per source: no rule replaces it, and each source keeps
 * its own use (the gnome casts it without a slot).
 */
export function grantedSpellsFor(input: GrantedSpellsInput): GrantedSpell[] {
  const level = Math.max(1, Math.round(input.level ?? 1));
  const seeds = classGrants(input.classId);
  const fromClass = seeds
    .filter((seed) => level >= seed.minLevel)
    .map((seed) => ({ ...seed, source: "class" as const }));

  const fromInvocations = hasInvocations(input.classId)
    ? invocationGrants(input.invocations ?? [], level)
    : [];

  return [
    ...fromSpecies(input.speciesId, input.speciesChoice, level),
    ...fromInvocations,
    ...fromClass,
    ...fromSubclass(input.classId, level, input.picks),
    ...fromFeats(input.featIds ?? [], input.picks),
  ];
}

function fromSubclass(
  classId: string,
  level: number,
  picks: readonly ChoicePick[] | undefined,
): GrantedSpell[] {
  if (level < SUBCLASS_LEVEL) return [];
  const subclassId = choiceValue(picks, `class:${classId}:subclass`);
  const subclass = subclassId ? getSubclass(subclassId) : undefined;
  if (!subclass) return [];
  const variant = choiceValue(picks, subclassSpellChoiceId(classId));
  return subclassSpellGrants(subclass.id, level, variant).map((grant) => ({
    ...grant,
    source: "subclass" as const,
    sourceLabel: variant ? `${subclass.name} (${variant})` : subclass.name,
    countsAgainstPrepared: false,
  }));
}

/** A spell a feat's choice settled — its level from the choice's spell family, else the pack. */
function fromFeats(
  featIds: readonly string[],
  picks: readonly ChoicePick[] | undefined,
): GrantedSpell[] {
  return featIds.flatMap((featId) => {
    const feat = getFeat(featId);
    if (!feat) return [];
    return (feat.choices ?? [])
      .filter((choice) => choice.kind === "spell")
      .flatMap((choice) => {
        const family =
          choice.pool.kind === "group" ? parseSpellGroup(choice.pool.group) : undefined;
        const ability = featSpellAbility(feat.choices ?? [], picks);
        return choiceValues(picks, choice.id).map((spellId) => ({
          spellId,
          source: "feat" as const,
          sourceLabel: feat.name,
          minLevel: 1,
          spellLevel: family?.level ?? activeContent()?.spells.get(spellId)?.level ?? 1,
          countsAgainstPrepared: false,
          ...(ability ? { ability } : {}),
        }));
      });
  });
}

function invocationGrants(
  picks: readonly (InvocationPick | string)[],
  level: number,
): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  const seen = new Set<string>();
  for (const invocation of validInvocations(picks, level)) {
    const def = getInvocation(invocation.id);
    for (const spell of def?.spells ?? []) {
      if (seen.has(spell.spellId)) continue;
      seen.add(spell.spellId);
      out.push({
        spellId: spell.spellId,
        source: "invocation",
        sourceLabel: pick({ fr: `Manifestation : ${def!.name}`, en: `Invocation: ${def!.name}` }),
        minLevel: Math.max(1, def!.minLevel),
        spellLevel: spell.spellLevel,
        countsAgainstPrepared: false,
      });
    }
  }
  return out;
}

function fromSpecies(
  speciesId: string | undefined,
  choice: string | undefined,
  level: number,
): GrantedSpell[] {
  const species = speciesId ? getSpecies(speciesId) : undefined;
  if (!species || !speciesId) return [];

  const lineage = getLineage(speciesId, choice);
  const grants: { spellId: string; minLevel: number; spellLevel: number; sourceLabel: string }[] = [
    ...(species.spells ?? []).map((g) => ({
      ...g,
      sourceLabel: species.spellsTrait ?? species.name,
    })),
    ...(lineage?.spells ?? []).map((g) => ({
      ...g,
      sourceLabel: `${species.spellsTrait ?? species.name} (${speciesOptionLabel(speciesId, choice ?? "")})`,
    })),
  ];

  return grants
    .filter((grant) => level >= grant.minLevel)
    .map((grant) => ({ ...grant, source: "species" as const, countsAgainstPrepared: false }));
}

/** The spellcasting ability a feat made the player pick, among its own choices. */
function featSpellAbility(
  choices: readonly { id: string; kind: string }[],
  picks: readonly ChoicePick[] | undefined,
): Ability | undefined {
  const choice = choices.find((entry) => entry.kind === "ability");
  const value = choice ? choiceValue(picks, choice.id) : undefined;
  return abilitySchema.safeParse(value).data;
}

/** Save DC and attack bonus of spells cast with `ability` — the 2024 formulas. */
export function spellcastingWith(
  ability: Ability,
  abilityModifiers: AbilityModifierBlock,
  proficiencyBonus: number,
): { ability: Ability; saveDc: number; attackBonus: number } {
  const modifier = abilityModifiers[ability];
  return {
    ability,
    saveDc: 8 + proficiencyBonus + modifier,
    attackBonus: proficiencyBonus + modifier,
  };
}
