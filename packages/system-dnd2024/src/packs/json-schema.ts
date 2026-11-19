/**
 * The pack format as a JSON Schema: every field, its type, the values it
 * accepts, its bounds — for an editor's autocompletion, a validator, or an AI
 * asked to write a pack. Generated from the very schemas the import uses, so
 * it cannot drift from what the import accepts.
 *
 * What a JSON Schema cannot say is left to the import (and the format page's
 * checker): references between entries, ids unique within a pack, and a kit
 * line holding either an item id or a choice.
 */

import { z } from "zod";
import { abilitySchema } from "../abilities";
import { classIdSchema } from "../classes";
import { diceSchema } from "../dice";
import { languageIdSchema } from "../languages";
import { pick, withLocale, type Locale } from "../locale";
import { mechanicSchema } from "../mechanics";
import { skillSchema } from "../skills";
import { creatureSizeSchema } from "../species";
import { damageKindSchema, spellSchoolSchema } from "../spells";
import {
  CONTENT_PACK_FORMAT,
  PACK_CONTENT_KIND_LABELS,
  contentPackSchema,
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
  type PackContentKind,
} from "./schema";

const ENTRY_SCHEMAS: [PackContentKind, z.ZodType][] = [
  ["classes", packClassSchema],
  ["species", packSpeciesSchema],
  ["backgrounds", packBackgroundSchema],
  ["subclasses", packSubclassSchema],
  ["feats", packFeatSchema],
  ["spells", packSpellSchema],
  ["monsters", packMonsterSchema],
  ["invocations", packInvocationSchema],
  ["languages", packLanguageSchema],
  ["weapons", packWeaponSchema],
  ["armors", packArmorSchema],
  ["gear", packGearSchema],
  ["equipmentPacks", packEquipmentPackSchema],
  ["tools", packToolSchema],
];

/** Shared lists, named: the file reads `"$ref": "#/$defs/skill"` rather than repeating them. */
const SHARED_SCHEMAS: [string, z.ZodType][] = [
  ["mechanic", mechanicSchema],
  ["ability", abilitySchema],
  ["skill", skillSchema],
  ["classId", classIdSchema],
  ["languageId", languageIdSchema],
  ["creatureSize", creatureSizeSchema],
  ["damageKind", damageKindSchema],
  ["spellSchool", spellSchoolSchema],
  ["die", diceSchema],
];

/**
 * The import refuses a field it does not know (`parse.ts`), where zod only
 * strips it: every object of the schema says so too.
 */
function closeObjects(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(closeObjects);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const schema = node as Record<string, unknown>;
  if (schema.type === "object" && schema.properties && !("additionalProperties" in schema)) {
    schema.additionalProperties = false;
  }
  Object.values(schema).forEach(closeObjects);
}

/** The pack format's JSON Schema, its titles in `language`. */
export function contentPackJsonSchema(language: Locale): Record<string, unknown> {
  return withLocale(language, () => {
    const names = z.registry<{ id: string; title?: string }>();
    for (const [kind, schema] of ENTRY_SCHEMAS) {
      names.add(schema, { id: kind, title: PACK_CONTENT_KIND_LABELS[kind] });
    }
    for (const [id, schema] of SHARED_SCHEMAS) names.add(schema, { id });

    const generated = z.toJSONSchema(contentPackSchema, {
      target: "draft-2020-12",
      // What a file may hold: the fields with a default are optional.
      io: "input",
      metadata: names,
      unrepresentable: "any",
    });
    closeObjects(generated);
    return {
      $schema: generated.$schema,
      title: pick({
        fr: `Pack de contenu Adventure Keeper (${CONTENT_PACK_FORMAT})`,
        en: `Adventure Keeper content pack (${CONTENT_PACK_FORMAT})`,
      }),
      description: pick({
        fr: "Les règles de chaque champ d'un pack : type, valeurs acceptées, longueurs et bornes. L'import vérifie en plus les références entre entrées et l'unicité des ids : passez le fichier au vérificateur de la page « Format des packs » avant de l'importer.",
        en: "The rules of every field of a pack: type, accepted values, lengths and bounds. The import also checks the references between entries and that ids are unique: run the file through the checker of the « Pack format » page before importing it.",
      }),
      ...generated,
    };
  });
}
