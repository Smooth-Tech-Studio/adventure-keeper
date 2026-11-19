import { describe, expect, it } from "vitest";

import * as engine from "./index";
import {
  ABILITY_LABELS,
  CLASSES,
  SKILLS_BY_LABEL,
  formatDistance,
  getClass,
  locale,
  localized,
  localizedList,
  resolveChoices,
  setLocale,
  speciesOptionLabel,
  translateById,
  withLocale,
} from "./index";

/** Text that reads as French: accents, guillemets, or a French function word. */
const FRENCH = /[éèàùêâîôûçœ«»]|\b(de|du|des|le|la|les|et|un|une|vous|votre|vos|au|aux|sur|avec)\b/;

/** Keys whose strings are values or ids, French by design (stored on sheets). */
const VALUE_KEYS = new Set([
  "id",
  "options",
  "choiceId",
  "classId",
  "speciesId",
  "value",
  "values",
  // A feature id (`"monk:2:Credo du Moine"`), not a text.
  "spends",
  // A trait named by its stored name (`"Héritage fiélon"`), not a text.
  "lineageTrait",
]);

/** Exports that are examples or fixtures, not built-in content. */
const SKIPPED_EXPORTS = new Set(["EXAMPLE_PACK", "EFFECTS_PACK", "EFFECTS"]);

function frenchStrings(value: unknown, path: string, out: string[], seen = new Set<unknown>()) {
  if (typeof value === "string") {
    if (FRENCH.test(value)) out.push(`${path}: ${value}`);
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (VALUE_KEYS.has(key)) continue;
    frenchStrings(child, `${path}.${key}`, out, seen);
  }
}

describe("locale", () => {
  it("defaults to French and switches", () => {
    expect(locale()).toBe("fr");
    expect(ABILITY_LABELS.str).toBe("Force");
    withLocale("en", () => expect(ABILITY_LABELS.str).toBe("Strength"));
    expect(ABILITY_LABELS.str).toBe("Force");
    setLocale("xx");
    expect(locale()).toBe("fr");
  });

  it("makes tables follow the locale through indexing and entries", () => {
    const table = localized({ fr: { a: "un" }, en: { a: "one" } });
    expect(Object.entries(table)).toEqual([["a", "un"]]);
    withLocale("en", () => {
      expect(table.a).toBe("one");
      expect({ ...table }).toEqual({ a: "one" });
    });
  });

  it("sorts lists per locale", () => {
    const list = localizedList(() => ["b", "a"].sort());
    expect([...list]).toEqual(["a", "b"]);
    expect(list.length).toBe(2);
    expect(Array.isArray(list)).toBe(true);
    // « Arcanes » sorts first in French, « Acrobatics » in English.
    expect(SKILLS_BY_LABEL[0]).toBe("acrobatics");
    withLocale("en", () => expect(SKILLS_BY_LABEL.map((s) => s)).toContain("animalHandling"));
  });

  it("translates nested definitions in place, keeping their shape", () => {
    const defs = [{ id: "x", name: "Épée", parts: [{ name: "Lame", weight: 2 }] }];
    translateById(defs, { en: { x: { name: "Sword", parts: [{ name: "Blade" }] } } });
    expect(defs[0].name).toBe("Épée");
    withLocale("en", () => {
      expect(defs[0].name).toBe("Sword");
      expect(defs[0].parts[0]).toEqual({ name: "Blade", weight: 2 });
      expect(JSON.parse(JSON.stringify(defs[0])).name).toBe("Sword");
    });
  });

  it("keeps ids and stored values French", () => {
    withLocale("en", () => {
      expect(getClass("barbarian")?.name).toBe("Barbarian");
      expect(CLASSES.map((c) => c.id)).toContain("barbarian");
      expect(speciesOptionLabel("elf", "Haut-elfe")).toBe("High Elf");
      expect(speciesOptionLabel("elf", "Elfe des bois")).toBe("Wood Elf");
      expect(formatDistance(30)).toBe("30 ft");
    });
    expect(speciesOptionLabel("elf", "Haut-elfe")).toBe("Haut-elfe");
    expect(formatDistance(30)).toBe("9 m");
  });

  it("leaves no French in the built-in content once in English", () => {
    const found: string[] = [];
    withLocale("en", () => {
      for (const [name, value] of Object.entries(engine)) {
        if (!/^[A-Z][A-Z0-9_]+$/.test(name) || SKIPPED_EXPORTS.has(name)) continue;
        frenchStrings(value, name, found);
      }
    });
    expect(found).toEqual([]);
  });

  it("generates English choice labels and hints", () => {
    const found: string[] = [];
    withLocale("en", () => {
      for (const klass of CLASSES) {
        const defs = resolveChoices({
          classId: klass.id,
          speciesId: "human",
          backgroundId: "custom",
          level: 20,
        });
        for (const def of defs) frenchStrings({ label: def.label, hint: def.hint }, def.id, found);
      }
    });
    expect(found).toEqual([]);
  });
});
