import { describe, expect, it } from "vitest";

import armorsFile from "./armors.json";
import packsFile from "./equipment-packs.json";
import gearFile from "./gear.json";
import spellsFile from "./spells.json";
import toolsFile from "./tools.json";
import weaponsFile from "./weapons.json";

/** Text that reads as French: accents, guillemets, or a French function word. */
const FRENCH = /[éèàùêâîôûçœ«»]|\b(de|du|des|le|la|les|et|un|une|vous|votre|au|aux|sur|avec)\b/;

const pair = (file: { entries: { id: string }[]; translations: { en: object } }) =>
  [file.entries, file.translations.en] as const;

const CATALOGS = {
  spells: pair(spellsFile),
  weapons: pair(weaponsFile),
  armors: pair(armorsFile),
  tools: pair(toolsFile),
  gear: pair(gearFile),
  "equipment-packs": pair(packsFile),
} as const;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("English catalogues", () => {
  for (const [name, [french, english]] of Object.entries(CATALOGS)) {
    it(`${name}: one English entry per French one`, () => {
      expect(Object.keys(english).sort()).toEqual(french.map((entry) => entry.id).sort());
    });

    it(`${name}: no French left`, () => {
      const leftovers = Object.entries(english).flatMap(([id, entry]) =>
        strings(entry)
          .filter((text) => FRENCH.test(text))
          .map((text) => `${id}: ${text}`),
      );
      expect(leftovers).toEqual([]);
    });

    it(`${name}: every French entry with a description has one in English`, () => {
      const missing = french
        .filter((entry) => "description" in entry && entry.description)
        .filter(
          (entry) => !(english as Record<string, { description?: string }>)[entry.id]?.description,
        )
        .map((entry) => entry.id);
      expect(missing).toEqual([]);
    });
  }
});
