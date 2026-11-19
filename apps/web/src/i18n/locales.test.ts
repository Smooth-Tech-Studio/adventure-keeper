import { describe, expect, it } from "vitest";

import { LANGUAGES, resources } from "@/i18n";

/** Every key of a translation tree, dotted: `nav.signIn`. */
function keys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** `stillGm_one` / `stillGm_other` are one key with plural forms. */
const withoutPlural = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");

/** `{{days}}` and `<strong>` must survive translation. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<(\w+)>/g)].map((m) => m[0]).sort();
}

function leaf(tree: object, path: string): string {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], tree) as string;
}

describe("translations", () => {
  const source = resources.fr;

  for (const language of LANGUAGES.filter((code) => code !== "fr")) {
    const target = resources[language];

    it(`${language} has the same namespaces as fr`, () => {
      expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
    });

    for (const ns of Object.keys(source) as (keyof typeof source)[]) {
      it(`${language}/${ns} has the same keys as fr/${ns}`, () => {
        const expected = [...new Set(keys(source[ns]).map(withoutPlural))].sort();
        const actual = [...new Set(keys(target[ns]).map(withoutPlural))].sort();
        expect(actual).toEqual(expected);
      });

      it(`${language}/${ns} keeps every placeholder and tag`, () => {
        for (const path of keys(source[ns])) {
          const translated = keys(target[ns]).includes(path) ? leaf(target[ns], path) : undefined;
          if (translated === undefined) continue; // plural forms differ by language
          expect(placeholders(translated), `${ns}:${path}`).toEqual(
            placeholders(leaf(source[ns], path)),
          );
        }
      });
    }
  }
});
