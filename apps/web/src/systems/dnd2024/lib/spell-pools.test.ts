import { describe, expect, it } from "vitest";
import {
  choicePoolValues,
  getFeat,
  parseSpellGroup,
  spellGroup,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";
import { buildChoiceContext } from "./choices";
import spellsFile from "../../../../../../packages/system-dnd2024/src/srd/spells.json";

const CATALOG = spellsFile.entries as unknown as SpellDef[];
const context = buildChoiceContext({
  tools: [],
  gear: [],
  spells: CATALOG,
  weapons: [],
  armors: [],
  packs: [],
});

/**
 * « Initié à la magie » used to offer the whole 213-spell catalogue, because
 * its pool was `any`. It now names a `classe:niveau` family that the app
 * resolves from the loaded spells.
 */
describe("vivier de sorts d'Initié à la magie", () => {
  const choicesOf = (id: string) => getFeat(id)?.choices ?? [];

  it("propose les sorts mineurs de la classe, pas tout le catalogue", () => {
    const [cantrips] = choicesOf("magic-initiate-cleric");
    const pool = choicePoolValues(cantrips, context);

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.length).toBeLessThan(CATALOG.length);
    for (const id of pool) {
      const spell = CATALOG.find((row) => row.id === id)!;
      expect(spell.level, spell.name).toBe(0);
      expect(spell.classes, spell.name).toContain("cleric");
    }
  });

  it("propose les sorts de niveau 1 de la classe pour le second choix", () => {
    const [, level1] = choicesOf("magic-initiate-druid");
    for (const id of choicePoolValues(level1, context)) {
      const spell = CATALOG.find((row) => row.id === id)!;
      expect(spell.level, spell.name).toBe(1);
      expect(spell.classes, spell.name).toContain("druid");
    }
  });

  it("donne trois viviers distincts aux trois listes", () => {
    const pools = ["cleric", "druid", "wizard"].map((list) =>
      choicePoolValues(choicesOf(`magic-initiate-${list}`)[0], context).join(","),
    );
    expect(new Set(pools).size).toBe(3);
  });

  it("ne rend rien tant que le catalogue n'est pas chargé", () => {
    const [cantrips] = choicesOf("magic-initiate-cleric");
    expect(choicePoolValues(cantrips, {})).toEqual([]);
  });

  it("nomme et relit une famille de sorts", () => {
    expect(spellGroup("cleric", 0)).toBe("cleric:0");
    expect(parseSpellGroup("wizard:1")).toEqual({ classId: "wizard", level: 1 });
    expect(parseSpellGroup("n'importe quoi")).toBeUndefined();
  });
});
