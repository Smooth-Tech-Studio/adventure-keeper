/**
 * Beasts as a character uses them: a familiar's forms (« Appel de familier »)
 * and the druid's Wild Shape forms. The stat blocks themselves are the monster
 * bank's (`monsters.ts`: AC, HP, speed, attacks); this module adds what a
 * player needs on top — the physical scores and the other ways of moving the
 * Wild Shape takes over — and the 2024 rules that say which beasts qualify.
 *
 * Numbers follow the SRD 5.2.1 stat blocks. A pack beast (`type: "beast"`)
 * qualifies too; without an entry here it simply shows no scores.
 */

import { allMonsters, getMonster, type MonsterDef } from "./monsters";

/** Strength, Dexterity, Constitution and the speeds other than walking, in feet. */
export type BeastStats = NonNullable<MonsterDef["beast"]>;

export function beastStats(id: string): BeastStats | undefined {
  return getMonster(id)?.beast;
}

/** « 1/4 » → 0.25. An unreadable rating counts as out of reach. */
export function challengeRatingValue(cr: string): number {
  const [num, den] = cr.split("/").map(Number);
  const value = den ? num / den : num;
  return Number.isFinite(value) ? value : Infinity;
}

// --- Familiars -----------------------------------------------------------------

/** The forms « Appel de familier » lists, before « another Beast of CR 0 ». */
export const FAMILIAR_FORM_IDS = [
  "bat",
  "cat",
  "crab",
  "frog",
  "hawk",
  "lizard",
  "octopus",
  "owl",
  "rat",
  "raven",
  "spider",
  "weasel",
] as const;

/** Every beast a familiar can take the form of: the listed ones, then any beast of CR 0. */
export function familiarForms(): MonsterDef[] {
  const listed = new Set<string>(FAMILIAR_FORM_IDS);
  return allMonsters().filter(
    (monster) =>
      listed.has(monster.id) ||
      (monster.type === "beast" && challengeRatingValue(monster.cr) === 0),
  );
}

// --- Wild Shape -----------------------------------------------------------------

/** What the druid's level allows (2024): forms known, highest CR, flying forms. */
export interface WildShapeRules {
  formsKnown: number;
  maxChallengeRating: number;
  /** « 1/4 », as printed. */
  maxChallengeLabel: string;
  canFly: boolean;
}

export function wildShapeRules(druidLevel: number): WildShapeRules {
  if (druidLevel >= 8)
    return { formsKnown: 8, maxChallengeRating: 1, maxChallengeLabel: "1", canFly: true };
  if (druidLevel >= 4)
    return { formsKnown: 6, maxChallengeRating: 0.5, maxChallengeLabel: "1/2", canFly: false };
  return { formsKnown: 4, maxChallengeRating: 0.25, maxChallengeLabel: "1/4", canFly: false };
}

/** Whether a beast is a form the druid may learn at this level. */
export function isWildShapeForm(monster: MonsterDef, druidLevel: number): boolean {
  const rules = wildShapeRules(druidLevel);
  if (monster.type !== "beast") return false;
  if (challengeRatingValue(monster.cr) > rules.maxChallengeRating) return false;
  return rules.canFly || !beastStats(monster.id)?.fly;
}

/** The beasts the druid may learn, lowest CR first. */
export function wildShapeForms(druidLevel: number): MonsterDef[] {
  return allMonsters()
    .filter((monster) => isWildShapeForm(monster, druidLevel))
    .sort(
      (a, b) =>
        challengeRatingValue(a.cr) - challengeRatingValue(b.cr) || a.name.localeCompare(b.name),
    );
}

/** How many forms a druid of this level must know: the rule, or every beast there is. */
export function wildShapeFormsDue(druidLevel: number): number {
  return Math.min(wildShapeRules(druidLevel).formsKnown, wildShapeForms(druidLevel).length);
}

/** The forms a sheet knows that still exist and are still allowed, in its order. */
export function knownWildShapeForms(ids: readonly string[], druidLevel: number): MonsterDef[] {
  return ids
    .map((id) => getMonster(id))
    .filter((monster): monster is MonsterDef => !!monster && isWildShapeForm(monster, druidLevel))
    .slice(0, wildShapeRules(druidLevel).formsKnown);
}
