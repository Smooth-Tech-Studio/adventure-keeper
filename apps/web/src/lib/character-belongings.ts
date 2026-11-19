import { CHARACTER_PRIVATE_FIELDS, type CharacterBelongings } from "@adventure-keeper/schemas";

const PRIVATE = new Set<string>(CHARACTER_PRIVATE_FIELDS);

/**
 * Share a sheet write between `characters/{id}` and its `private/belongings`.
 *
 * Every private field is removed from the main doc (`deleted`), even when the
 * write does not touch it: a sheet saved before the split loses its old copy
 * on its first save. On the belongings side a field set to `undefined` is a
 * field the player cleared (`deleted`); a field left out is left alone.
 * `deleted` is Firestore's `deleteField()`, passed in to keep this pure.
 */
export function splitBelongings(
  fields: Record<string, unknown>,
  deleted: unknown,
): { main: Record<string, unknown>; belongings: Record<string, unknown> } {
  const main: Record<string, unknown> = {};
  const belongings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (PRIVATE.has(key)) belongings[key] = value === undefined ? deleted : value;
    else main[key] = value;
  }
  for (const key of CHARACTER_PRIVATE_FIELDS) main[key] = deleted;
  return { main, belongings };
}

/**
 * The first `private/belongings` of a sheet saved before the split: what the
 * main doc still holds, under the write's private fields (`undefined` or
 * `deleted`: cleared). Written whole, so it carries no sentinel.
 */
export function seedBelongings(
  current: Record<string, unknown>,
  fields: Record<string, unknown>,
  deleted: unknown,
): CharacterBelongings {
  const seeded: Record<string, unknown> = {};
  for (const key of CHARACTER_PRIVATE_FIELDS) {
    const value = key in fields ? fields[key] : current[key];
    if (value !== undefined && value !== deleted) seeded[key] = value;
  }
  return seeded as CharacterBelongings;
}

/**
 * A whole sheet from its two docs. With a `private/belongings` doc, its
 * fields are the sheet's (one it lacks stays absent). Without one — a reader
 * it is closed to, or a sheet not migrated yet — the main doc stands as is.
 */
export function mergeBelongings<T extends Record<string, unknown>>(
  main: T,
  belongings: CharacterBelongings | null,
): T {
  if (!belongings) return main;
  const merged: Record<string, unknown> = { ...main };
  for (const key of CHARACTER_PRIVATE_FIELDS) {
    if (belongings[key] === undefined) delete merged[key];
    else merged[key] = belongings[key];
  }
  return merged as T;
}
