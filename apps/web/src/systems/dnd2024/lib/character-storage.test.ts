import { afterEach, describe, expect, it } from "vitest";
import {
  EXAMPLE_PACK,
  createContentOverlay,
  parseContentPack,
  setActiveContent,
  type ContentPack,
} from "@adventure-keeper/system-dnd2024";

import { previewDnd2024Character } from "@/systems/dnd2024/lib/character-storage";

function examplePack(): ContentPack {
  const result = parseContentPack(EXAMPLE_PACK);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.pack;
}

const CLASS_ID = "brumes-du-nord:veilleur-des-brumes";

describe("the pack entries a sheet keeps", () => {
  afterEach(() => setActiveContent(null));

  it("keeps a pack class, so the sheet still derives once the pack is gone", () => {
    setActiveContent(createContentOverlay([examplePack()]));
    const sheet = previewDnd2024Character(
      {
        system: "dnd2024",
        name: "Ysolde",
        classId: CLASS_ID,
        level: 1,
        speciesId: "dwarf",
        backgroundId: "soldier",
        baseAbilityScores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
        backgroundAbilityBonuses: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
      } as Parameters<typeof previewDnd2024Character>[0],
      "new",
    );
    const classes = (sheet.packContent ?? []).flatMap((pack) => pack.content.classes);
    expect(classes.map((klass) => klass.id)).toEqual(["veilleur-des-brumes"]);
    // d10 + Con +2 + Dwarven Toughness.
    expect(sheet.maxHitPoints).toBe(13);
  });
});
