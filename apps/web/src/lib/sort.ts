import { currentLanguage } from "@/i18n";

/**
 * Alphabetical comparison in the interface language (accents and case
 * ignored: « Épée » sits with the E's).
 */
export const compareText = (a: string, b: string): number =>
  a.localeCompare(b, currentLanguage(), { sensitivity: "base" });

/** A copy of `items` sorted alphabetically (interface language) on the string `label` returns. */
export function sortedByLabel<T>(items: readonly T[], label: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareText(label(a), label(b)));
}
