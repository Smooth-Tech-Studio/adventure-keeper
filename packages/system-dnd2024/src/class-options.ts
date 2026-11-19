/**
 * The « au choix » of the class tables: Druid « Ordre primitif », Cleric
 * « Ordre divin », then « Impacts bénis » / « Fureur élémentaire » at level 7.
 *
 * Each becomes an `option` {@link ChoiceDef} (`class:<classId>:<slug>`) whose
 * values are the option ids below; what an option changes is its
 * {@link Mechanic} list, folded in by the engine like any feature's. Before
 * these existed the app applied one side of the choice to everybody — every
 * druid could wear medium armour, which only the Warden may.
 */

import type { ChoiceDef } from "./choices";
import { allClasses } from "./classes";
import type { Mechanic } from "./mechanics";

export interface ClassOptionDef {
  /** Unique across classes: `"<slug>-<option>"` (`"primal-order-warden"`). */
  id: string;
  name: string;
  /** One line, our words — what the option changes. */
  summary: string;
  mechanics: Mechanic[];
}

export interface ClassOptionChoiceDef {
  /** A `ClassId`, or `"pack:slug"` for a pack class. */
  classId: string;
  /** The choice is `class:<classId>:<slug>`. */
  slug: string;
  /** Class level at which it is made. */
  level: number;
  label: string;
  options: ClassOptionDef[];
}

/** Every class option choice: the classes carry them (`ClassDef.options`). */
function seeds(): ClassOptionChoiceDef[] {
  return allClasses().flatMap((klass) =>
    (klass.options ?? []).map((choice) => ({ ...choice, classId: klass.id })),
  );
}

/** Every class option choice (read in the current locale). */
export function classOptionChoices(classId?: string): ClassOptionChoiceDef[] {
  const all = seeds();
  return classId ? all.filter((choice) => choice.classId === classId) : all;
}

/** The option behind a picked value (`"primal-order-warden"`), in any class. */
export function getClassOption(id: string): ClassOptionDef | undefined {
  for (const choice of seeds()) {
    const option = choice.options.find((o) => o.id === id);
    if (option) return option;
  }
  return undefined;
}

/** The choice id of a class option (`class:druid:primal-order`). */
export const classOptionChoiceId = (choice: Pick<ClassOptionChoiceDef, "classId" | "slug">) =>
  `class:${choice.classId}:${choice.slug}`;

/** The class's option choices, as `ChoiceDef`s for the wizard and the level-up. */
export function classOptionChoiceDefs(classId: string): ChoiceDef[] {
  return classOptionChoices(classId).map((choice) => ({
    id: classOptionChoiceId(choice),
    source: "class",
    kind: "option",
    label: choice.label,
    count: 1,
    pool: { kind: "list", values: choice.options.map((o) => o.id) },
    ...(choice.level > 1 ? { minLevel: choice.level } : {}),
  }));
}
