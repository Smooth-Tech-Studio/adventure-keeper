/**
 * Reading a pack file: schema validation with messages a player can act
 * on, plus the checks a schema cannot express (duplicate ids, references that
 * point nowhere). Never throws — a bad file is an expected input.
 */

import { z } from "zod";
import { locale, localized, pick } from "../locale";
import { getClass } from "../classes";
import { getLanguage } from "../languages";
import { getFeat } from "../feats";
import { packEntryId, resolvePackRef } from "./registry";
import {
  PACK_CONTENT_KINDS,
  PACK_CONTENT_KIND_LABELS,
  PACK_SYSTEM,
  contentPackSchema,
  type ContentPack,
  type PackContentKind,
} from "./schema";
import { packLanguage } from "./translations";

export type ParseContentPackResult =
  { ok: true; pack: ContentPack } | { ok: false; errors: string[] };

const TYPE_LABELS = localized({
  fr: {
    string: "du texte",
    number: "un nombre",
    integer: "un nombre entier",
    int: "un nombre entier",
    boolean: "vrai ou faux",
    array: "une liste",
    object: "un objet",
    undefined: "rien",
    null: "null",
  },
  en: {
    string: "text",
    number: "a number",
    integer: "a whole number",
    int: "a whole number",
    boolean: "true or false",
    array: "a list",
    object: "an object",
    undefined: "nothing",
    null: "null",
  },
}) as Record<string, string>;

/** The type of what was received, in the words of `TYPE_LABELS`. */
function receivedType(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  return typeof input;
}

/** Zod's defaults, in the engine's locale — scoped to this parse, not global. */
const localeErrors: z.ZodErrorMap = (issue) => {
  const message = (fr: string, en: string) => pick({ fr, en });
  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined) {
        return message("champ obligatoire manquant", "required field missing");
      }
      const expected = TYPE_LABELS[issue.expected] ?? issue.expected;
      const got = receivedType(issue.input);
      const received = TYPE_LABELS[got] ?? got;
      return message(
        `${expected} attendu, reçu ${received}`,
        `expected ${expected}, got ${received}`,
      );
    }
    case "invalid_value":
      return issue.values.length === 1
        ? message(
            `valeur attendue : « ${String(issue.values[0])} »`,
            `expected value: “${String(issue.values[0])}”`,
          )
        : message(
            `valeur inconnue « ${String(issue.input)} » — possibles : ${issue.values.join(", ")}`,
            `unknown value “${String(issue.input)}” — allowed: ${issue.values.join(", ")}`,
          );
    case "too_small":
      if (issue.origin === "string") return message("ne doit pas être vide", "must not be empty");
      if (issue.origin === "array")
        return issue.exact
          ? message(
              `exactement ${issue.minimum} élément(s) attendu(s)`,
              `exactly ${issue.minimum} item(s) expected`,
            )
          : message(
              `au moins ${issue.minimum} élément(s) attendu(s)`,
              `at least ${issue.minimum} item(s) expected`,
            );
      return message(`doit valoir au moins ${issue.minimum}`, `must be at least ${issue.minimum}`);
    case "too_big":
      if (issue.origin === "string") {
        return message(
          `${issue.maximum} caractères au maximum`,
          `${issue.maximum} characters at most`,
        );
      }
      if (issue.origin === "array")
        return issue.exact
          ? message(
              `exactement ${issue.maximum} élément(s) attendu(s)`,
              `exactly ${issue.maximum} item(s) expected`,
            )
          : message(`${issue.maximum} élément(s) au maximum`, `${issue.maximum} item(s) at most`);
      return message(`doit valoir au plus ${issue.maximum}`, `must be at most ${issue.maximum}`);
    case "invalid_union":
      return message("valeur non reconnue", "unrecognised value");
    case "unrecognized_keys":
      return message(
        `champ(s) inconnu(s) : ${issue.keys.join(", ")}`,
        `unknown field(s): ${issue.keys.join(", ")}`,
      );
    default:
      // Zod's own message.
      return undefined;
  }
};

/** An issue's path, without the symbol keys zod 4 allows (none in a JSON file). */
export const issuePath = (path: readonly PropertyKey[]): (string | number)[] =>
  path.filter((key): key is string | number => typeof key !== "symbol");

/**
 * The schema's own messages (`.regex(…, "…")`, `.refine`) are fixed French
 * strings; their English, by French text — or by pattern when they quote a
 * value.
 */
const CUSTOM_MESSAGES_EN: Record<string, string> = {
  "minuscules, chiffres et tirets uniquement (ex. « voie-du-zelateur »)":
    "lowercase letters, digits and dashes only (e.g. “path-of-the-zealot”)",
  "« id » ou « fromChoice », l'un des deux": "either “id” or “fromChoice”, not both",
  "FP attendu : 0, 1/8, 1/4, 1/2 ou 1 à 30": "CR expected: 0, 1/8, 1/4, 1/2 or 1 to 30",
  "version attendue sous la forme 1.0.0": "version expected in the form 1.0.0",
};

function localizeMessage(message: string): string {
  if (locale() === "fr") return message;
  const exact = CUSTOM_MESSAGES_EN[message];
  if (exact) return exact;
  const option = message.match(/^« (.*) » n'est pas une des options de « choice »$/);
  return option ? `“${option[1]}” is not one of the “choice” options` : message;
}

/** « field: message » with the locale's punctuation (a space before the colon in French). */
const colon = () => pick({ fr: " : ", en: ": " });

/**
 * The same readable messages for any file the app imports (campaign and
 * adventure files too): the error map, and « field: message » punctuation.
 */
export const importErrorMap: z.ZodErrorMap = localeErrors;
export const importColon = colon;

/** `content.feats[2].effects` → `Don n°3 « Nom » › effects`. */
function describePath(path: (string | number)[], raw: unknown): string {
  if (path[0] === "content" && typeof path[1] === "string" && typeof path[2] === "number") {
    const kind = path[1] as PackContentKind;
    const label = PACK_CONTENT_KIND_LABELS[kind] ?? kind;
    const entry = (raw as { content?: Record<string, unknown[]> })?.content?.[kind]?.[path[2]];
    const name = (entry as { name?: unknown } | undefined)?.name;
    const quoted = typeof name === "string" ? pick({ fr: ` « ${name} »`, en: ` “${name}”` }) : "";
    const head = `${label} ${pick({ fr: "n°", en: "#" })}${path[2] + 1}${quoted}`;
    const rest = path.slice(3).join(".");
    return rest ? `${head} › ${rest}` : head;
  }
  return path.length ? path.join(".") : "Pack";
}

/** Checks across entries that no schema can express. */
function crossCheck(pack: ContentPack): string[] {
  const errors: string[] = [];

  for (const kind of PACK_CONTENT_KINDS) {
    const seen = new Set<string>();
    for (const entry of pack.content[kind]) {
      if (seen.has(entry.id)) {
        errors.push(
          pick({
            fr: `${PACK_CONTENT_KIND_LABELS[kind]} : l'identifiant « ${entry.id} » est utilisé deux fois.`,
            en: `${PACK_CONTENT_KIND_LABELS[kind]}: the id “${entry.id}” is used twice.`,
          }),
        );
      }
      seen.add(entry.id);
    }
  }

  const localFeats = new Set(pack.content.feats.map((feat) => feat.id));
  for (const background of pack.content.backgrounds) {
    if (!background.originFeatId) continue;
    const ref = resolvePackRef(pack.id, background.originFeatId, localFeats);
    const local = ref === packEntryId(pack.id, background.originFeatId);
    // References to *other* packs can only be checked once those are loaded.
    if (!local && !ref.includes(":") && !getFeat(ref)) {
      errors.push(
        pick({
          fr: `Historique « ${background.name} » › originFeatId : aucun don « ${background.originFeatId} », ni dans ce pack ni dans le SRD.`,
          en: `Background “${background.name}” › originFeatId: no feat “${background.originFeatId}”, neither in this pack nor in the SRD.`,
        }),
      );
    }
  }

  // A class named by its slug lives in this pack or in the SRD.
  const localClasses = new Set(pack.content.classes.map((klass) => klass.id));
  const checkClass = (ref: string, path: (string | number)[]) => {
    if (ref.includes(":") || localClasses.has(ref) || getClass(ref)) return;
    errors.push(
      `${describePath(path, pack)}${colon()}${pick({
        fr: `aucune classe « ${ref} », ni dans ce pack ni dans le SRD`,
        en: `no class “${ref}”, neither in this pack nor in the SRD`,
      })}`,
    );
  };
  pack.content.subclasses.forEach((subclass, index) =>
    checkClass(subclass.classId, ["content", "subclasses", index, "classId"]),
  );
  pack.content.spells.forEach((spell, index) =>
    spell.classes.forEach((ref, at) =>
      checkClass(ref, ["content", "spells", index, "classes", at]),
    ),
  );

  // A language named by its slug lives in this pack or in the SRD.
  const localLanguages = new Set(pack.content.languages.map((language) => language.id));
  const checkLanguage = (ref: string, path: (string | number)[]) => {
    if (ref.includes(":") || localLanguages.has(ref) || getLanguage(ref)) return;
    errors.push(
      `${describePath(path, pack)}${colon()}${pick({
        fr: `aucune langue « ${ref} », ni dans ce pack ni dans le SRD`,
        en: `no language “${ref}”, neither in this pack nor in the SRD`,
      })}`,
    );
  };
  for (const kind of ["species", "classes"] as const) {
    pack.content[kind].forEach((entry, index) =>
      (entry.languages ?? []).forEach((ref, at) =>
        checkLanguage(ref, ["content", kind, index, "languages", at]),
      ),
    );
  }

  errors.push(...translationErrors(pack));
  return errors;
}

/**
 * A translation must match the pack: an entry it names exists, and each text
 * it gives has a source text at the same place (same key, same position).
 */
function translationErrors(pack: ContentPack): string[] {
  const errors: string[] = [];
  const own = packLanguage(pack);
  for (const [code, translation] of Object.entries(pack.translations ?? {})) {
    const where = `translations.${code}`;
    if (code === own) {
      errors.push(
        pick({
          fr: `${where} : le pack est déjà écrit dans cette langue (« language »).`,
          en: `${where}: the pack is already written in this language (“language”).`,
        }),
      );
      continue;
    }
    for (const kind of PACK_CONTENT_KINDS) {
      const entries = new Map(
        (pack.content[kind] as { id: string }[]).map((entry) => [entry.id, entry]),
      );
      for (const [slug, shadow] of Object.entries(translation.content[kind] ?? {})) {
        const path = `${where}.content.${kind}.${slug}`;
        const entry = entries.get(slug);
        if (!entry) {
          errors.push(
            pick({
              fr: `${path} : aucune entrée « ${slug} » dans ce pack.`,
              en: `${path}: no entry “${slug}” in this pack.`,
            }),
          );
          continue;
        }
        shapeErrors(entry, shadow, path, errors);
      }
    }
  }
  return errors;
}

/** Every text of `shadow` must have a source at the same place in `source`. */
function shapeErrors(source: unknown, shadow: unknown, path: string, errors: string[]): void {
  if (shadow === undefined) return;
  const missing = () =>
    errors.push(
      pick({
        fr: `${path} : rien à traduire ici — ce texte n'existe pas dans le pack.`,
        en: `${path}: nothing to translate here — this text is not in the pack.`,
      }),
    );
  if (typeof shadow === "string") {
    if (typeof source !== "string") missing();
    return;
  }
  if (Array.isArray(shadow)) {
    if (!Array.isArray(source) || shadow.length > source.length) {
      missing();
      return;
    }
    shadow.forEach((item, index) => shapeErrors(source[index], item, `${path}[${index}]`, errors));
    return;
  }
  if (isPlainObject(shadow)) {
    if (!isPlainObject(source)) {
      missing();
      return;
    }
    for (const [key, value] of Object.entries(shadow)) {
      shapeErrors(source[key], value, `${path}.${key}`, errors);
    }
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keys of the file the schema does not know. Zod strips them silently, so they
 * are exactly the keys of `raw` missing from the parsed output — defaults only
 * ever add keys. Reported on import only: packs already stored go through the
 * same schema, leniently, so tightening the format never breaks them.
 */
function unknownKeys(
  raw: unknown,
  parsed: unknown,
  path: (string | number)[],
  out: { path: (string | number)[]; keys: string[] }[],
): void {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((item, index) => unknownKeys(item, parsed[index], [...path, index], out));
    return;
  }
  if (!isPlainObject(raw) || !isPlainObject(parsed)) return;
  const extra = Object.keys(raw).filter((key) => !(key in parsed));
  if (extra.length) out.push({ path, keys: extra });
  for (const key of Object.keys(raw)) {
    if (key in parsed) unknownKeys(raw[key], parsed[key], [...path, key], out);
  }
}

/** Validate a pack read from JSON (already `JSON.parse`d). */
export function parseContentPack(raw: unknown): ParseContentPackResult {
  const result = contentPackSchema.safeParse(raw, { error: localeErrors });
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) =>
          `${describePath(issuePath(issue.path), raw)}${colon()}${localizeMessage(issue.message)}`,
      ),
    };
  }
  const unknown: { path: (string | number)[]; keys: string[] }[] = [];
  unknownKeys(raw, result.data, [], unknown);
  const errors = [
    ...unknown.map(
      ({ path, keys }) =>
        `${describePath(path, raw)}${colon()}${pick({
          fr: `champ(s) inconnu(s) : ${keys.join(", ")}`,
          en: `unknown field(s): ${keys.join(", ")}`,
        })}`,
    ),
    ...crossCheck(result.data),
  ];
  return errors.length ? { ok: false, errors } : { ok: true, pack: result.data };
}

/** Validate a pack from the text of a `.json` file. */
export function parseContentPackJson(json: string): ParseContentPackResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      errors: [
        pick({
          fr: `Ce fichier n'est pas du JSON valide (${(error as Error).message}).`,
          en: `This file is not valid JSON (${(error as Error).message}).`,
        }),
      ],
    };
  }
  return parseContentPack(raw);
}

/** The pack as a `.json` file's text — what import reads back unchanged. */
export function contentPackToJson(pack: ContentPack): string {
  return `${JSON.stringify({ ...pack, system: PACK_SYSTEM }, null, 2)}\n`;
}
