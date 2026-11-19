import { describe, expect, it } from "vitest";

import { contentPackJsonSchema } from "./json-schema";
import { PACK_CONTENT_KINDS, packSpellSchema } from "./schema";

type Node = Record<string, unknown>;

describe("the pack format's JSON Schema", () => {
  const schema = contentPackJsonSchema("fr");
  const defs = schema.$defs as Record<string, Node>;

  it("names one definition per kind of entry, and none by number", () => {
    const content = (schema.properties as Record<string, Node>).content!;
    for (const kind of PACK_CONTENT_KINDS) {
      expect(defs[kind]).toBeDefined();
      const list = (content.properties as Record<string, Node>)[kind]!;
      expect((list.items as Node).$ref).toBe(`#/$defs/${kind}`);
    }
    expect(defs.mechanic).toBeDefined();
    expect(Object.keys(defs).filter((id) => id.startsWith("__"))).toEqual([]);
  });

  it("holds every field of an entry, with its rules", () => {
    const spell = defs.spells!;
    expect(Object.keys(spell.properties as Node).sort()).toEqual(
      Object.keys(packSpellSchema.shape).sort(),
    );
    // A level, bounded as the import bounds it.
    expect((spell.properties as Record<string, Node>).level).toMatchObject({
      minimum: 0,
      maximum: 9,
    });
  });

  it("refuses unknown fields, as the import does", () => {
    expect(schema.additionalProperties).toBe(false);
    expect(defs.spells!.additionalProperties).toBe(false);
  });

  it("titles itself in the asked language", () => {
    expect(contentPackJsonSchema("en").title).toMatch(/^Adventure Keeper content pack/);
    expect(schema.title).toMatch(/^Pack de contenu/);
  });
});
