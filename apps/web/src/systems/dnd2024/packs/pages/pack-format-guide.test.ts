import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  EXAMPLE_PACK,
  PACK_CONTENT_KINDS,
  packBackgroundSchema,
  packClassSchema,
  packArmorSchema,
  packEquipmentPackSchema,
  packFeatSchema,
  packGearSchema,
  packInvocationSchema,
  packLanguageSchema,
  packMonsterSchema,
  packSpeciesSchema,
  packSpellSchema,
  packSubclassSchema,
  packToolSchema,
  packWeaponSchema,
  parseContentPack,
  type PackContentKind,
} from "@adventure-keeper/system-dnd2024";

import { KIND_GUIDE } from "@/systems/dnd2024/packs/pages/pack-format-guide";

const SCHEMAS: Record<PackContentKind, z.ZodType> = {
  classes: packClassSchema,
  species: packSpeciesSchema,
  backgrounds: packBackgroundSchema,
  subclasses: packSubclassSchema,
  feats: packFeatSchema,
  spells: packSpellSchema,
  monsters: packMonsterSchema,
  invocations: packInvocationSchema,
  languages: packLanguageSchema,
  weapons: packWeaponSchema,
  armors: packArmorSchema,
  gear: packGearSchema,
  equipmentPacks: packEquipmentPackSchema,
  tools: packToolSchema,
};

/** The fields of an entry schema (a refinement keeps the object schema in zod 4). */
function fieldsOf(schema: z.ZodType): string[] {
  if (schema instanceof z.ZodObject) return Object.keys(schema.shape);
  throw new Error("not an object schema");
}

/** « range, duration » / « darkvision ? » → the field names a guide row covers. */
const documented = (kind: PackContentKind) =>
  new Set([
    "id",
    "name",
    ...KIND_GUIDE[kind].rows.flatMap(([field]) =>
      field.split(",").map((part) => part.replace("?", "").trim()),
    ),
  ]);

describe("the pack format guide", () => {
  it.each(PACK_CONTENT_KINDS)("documents every field of « %s »", (kind) => {
    const missing = fieldsOf(SCHEMAS[kind]).filter((field) => !documented(kind).has(field));
    expect(missing).toEqual([]);
  });

  it("offers an example pack the import accepts, with an entry of every kind", () => {
    const parsed = parseContentPack(EXAMPLE_PACK);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const kind of PACK_CONTENT_KINDS)
      expect(parsed.pack.content[kind].length).toBeGreaterThan(0);
  });
});
