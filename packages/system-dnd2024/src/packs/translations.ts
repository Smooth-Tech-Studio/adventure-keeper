/**
 * A pack's translations: one pack, several languages. `language` says what the
 * pack is written in; `translations` holds, per other language, the *text* of
 * the pack in that language — the same shape as the entries, keyed by entry
 * id, keeping only the strings to translate (names, blurbs, summaries…).
 *
 * ```json
 * "translations": {
 *   "en": {
 *     "name": "Northern Mists",
 *     "content": { "feats": { "veilleur": { "name": "Watcher", "summary": "…" } } }
 *   }
 * }
 * ```
 *
 * Arrays match by position (`traits`, `features`, `attacks`, `choices`),
 * records by key (`lineages`, keyed by the source option). A missing text
 * falls back to the source language.
 *
 * Values a sheet *stores* — a species option, a subclass variant's name —
 * never change: their translation is only a display label
 * ({@link PackDisplayLabels}).
 */

import { z } from "zod";
import { LOCALES, locale, translateTree, type Locale, type Shadow } from "../locale";

const text = (max: number) => z.string().trim().min(1).max(max);

/** `[{ label?, hint? }]` — a choice's texts, by position. */
const choicesShadow = z.array(
  z.object({ label: text(120).optional(), hint: text(200).optional() }),
);

/** A mechanic's texts (a condition, a note), by position. */
const mechanicsShadow = z.array(z.record(z.string(), text(400)));

export const packClassShadowSchema = z.object({
  name: text(80).optional(),
  blurb: text(160).optional(),
  subclassLabel: text(40).optional(),
  bonusSkill: z.object({ label: text(80).optional(), hint: text(200).optional() }).optional(),
  spells: z.array(z.object({ label: text(80).optional() })).optional(),
  startingEquipment: z
    .object({
      options: z
        .array(z.object({ label: text(80).optional(), choices: choicesShadow.optional() }))
        .optional(),
    })
    .optional(),
  options: z
    .array(
      z.object({
        label: text(80).optional(),
        options: z
          .array(
            z.object({
              name: text(80).optional(),
              summary: text(400).optional(),
              mechanics: mechanicsShadow.optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  features: z
    .array(
      z.object({
        name: text(80).optional(),
        summary: text(600).optional(),
        mechanics: mechanicsShadow.optional(),
        roll: z.object({ label: text(80).optional() }).optional(),
      }),
    )
    .optional(),
});

export const packSpeciesShadowSchema = z.object({
  name: text(80).optional(),
  blurb: text(160).optional(),
  /** `options`: the label of each source option, by position. */
  choice: z
    .object({ label: text(80).optional(), options: z.array(text(80)).optional() })
    .optional(),
  /** Keyed by the source option. */
  lineages: z.record(z.string(), z.object({ summary: text(400).optional() })).optional(),
  spellsTrait: text(80).optional(),
  skillGrant: z.object({ trait: text(80).optional() }).optional(),
  originFeatGrant: z.object({ trait: text(80).optional() }).optional(),
  breathWeapon: z.object({ name: text(80).optional(), shapes: text(120).optional() }).optional(),
  traits: z
    .array(
      z.object({
        name: text(80).optional(),
        summary: text(400).optional(),
        mechanics: mechanicsShadow.optional(),
        roll: z.object({ label: text(80).optional() }).optional(),
      }),
    )
    .optional(),
});

export const packBackgroundShadowSchema = z.object({
  name: text(80).optional(),
  blurb: text(160).optional(),
  toolProficiency: z.object({ label: text(80).optional() }).optional(),
  startingKit: z.object({ choices: choicesShadow.optional() }).optional(),
});

export const packSubclassShadowSchema = z.object({
  name: text(80).optional(),
  blurb: text(160).optional(),
  features: z
    .array(
      z.object({
        name: text(80).optional(),
        summary: text(600).optional(),
        mechanics: mechanicsShadow.optional(),
        roll: z.object({ label: text(80).optional() }).optional(),
      }),
    )
    .optional(),
  spellVariants: z
    .object({
      label: text(80).optional(),
      hint: text(200).optional(),
      options: z
        .array(z.object({ name: text(80).optional(), summary: text(400).optional() }))
        .optional(),
    })
    .optional(),
});

export const packFeatShadowSchema = z.object({
  name: text(80).optional(),
  blurb: text(160).optional(),
  summary: text(600).optional(),
  prerequisite: text(160).optional(),
  choices: choicesShadow.optional(),
  combatNote: text(400).optional(),
  bonusAction: text(160).optional(),
});

export const packSpellShadowSchema = z.object({
  name: text(80).optional(),
  castingTime: text(60).optional(),
  range: text(60).optional(),
  duration: text(60).optional(),
  summary: text(600).optional(),
  damage: z.object({ note: z.string().optional() }).optional(),
});

export const packMonsterShadowSchema = z.object({
  name: text(80).optional(),
  attacks: z
    .array(
      z.object({
        name: text(80).optional(),
        reach: text(40).optional(),
        note: text(600).optional(),
      }),
    )
    .optional(),
});

export const packToolShadowSchema = z.object({
  name: text(80).optional(),
  description: text(300).optional(),
});

export const packInvocationShadowSchema = z.object({
  name: text(80).optional(),
  condition: text(200).optional(),
  summary: text(600).optional(),
});

const nameShadow = z.object({ name: text(80).optional() });
const describedShadow = z.object({
  name: text(80).optional(),
  description: text(300).optional(),
});

/** The pack in one other language. */
export const packTranslationSchema = z.object({
  name: text(80).optional(),
  description: text(2000).optional(),
  author: text(80).optional(),
  content: z
    .object({
      classes: z.record(z.string(), packClassShadowSchema).optional(),
      species: z.record(z.string(), packSpeciesShadowSchema).optional(),
      backgrounds: z.record(z.string(), packBackgroundShadowSchema).optional(),
      subclasses: z.record(z.string(), packSubclassShadowSchema).optional(),
      feats: z.record(z.string(), packFeatShadowSchema).optional(),
      spells: z.record(z.string(), packSpellShadowSchema).optional(),
      monsters: z.record(z.string(), packMonsterShadowSchema).optional(),
      invocations: z.record(z.string(), packInvocationShadowSchema).optional(),
      languages: z
        .record(z.string(), z.object({ name: text(80).optional(), summary: text(300).optional() }))
        .optional(),
      tools: z.record(z.string(), packToolShadowSchema).optional(),
      weapons: z.record(z.string(), nameShadow).optional(),
      armors: z.record(z.string(), describedShadow).optional(),
      gear: z.record(z.string(), describedShadow).optional(),
      equipmentPacks: z.record(z.string(), nameShadow).optional(),
    })
    .prefault({}),
});
export type PackTranslation = z.infer<typeof packTranslationSchema>;

export const packTranslationsSchema = z.partialRecord(z.enum(LOCALES), packTranslationSchema);
export type PackTranslations = Partial<Record<Locale, PackTranslation>>;

interface TranslatablePack {
  language?: Locale;
  translations?: PackTranslations;
}

/** The language a pack is written in — French when it does not say. */
export function packLanguage(pack: { language?: Locale }): Locale {
  return pack.language ?? "fr";
}

/** Every language a pack can be read in: its own first, then its translations. */
export function packLanguages(pack: TranslatablePack): Locale[] {
  const own = packLanguage(pack);
  const others = Object.keys(pack.translations ?? {}).filter(
    (code): code is Locale => code !== own && (LOCALES as readonly string[]).includes(code),
  );
  return [own, ...others];
}

/** The pack's name, description or author in the current locale, else in its own. */
export function packText(
  pack: TranslatablePack & { name?: string; description?: string; author?: string },
  field: "name" | "description" | "author",
): string | undefined {
  const code = locale();
  const translated = code === packLanguage(pack) ? undefined : pack.translations?.[code]?.[field];
  return translated ?? pack[field];
}

/** The shadows of one entry, by locale — what `translateTree` takes. */
export function entryShadows(
  pack: TranslatablePack,
  kind: keyof PackTranslation["content"],
  slug: string,
): Partial<Record<Locale, Shadow>> {
  const shadows: Partial<Record<Locale, Shadow>> = {};
  for (const [code, translation] of Object.entries(pack.translations ?? {}) as [
    Locale,
    PackTranslation,
  ][]) {
    const shadow = translation.content[kind]?.[slug];
    if (shadow) shadows[code] = shadow as Shadow;
  }
  return shadows;
}

/** Display labels for values a sheet stores, by locale: `{ en: { "Haut-elfe": "High Elf" } }`. */
export type PackDisplayLabels = Partial<Record<Locale, Record<string, string>>>;

/**
 * `source[i]` → `shadow[i]`, per locale: the labels of stored values (species
 * options, variant names) the translations give by position.
 */
export function positionalLabels(
  source: readonly string[],
  byLocale: Partial<Record<Locale, readonly (string | undefined)[] | undefined>>,
): PackDisplayLabels {
  const labels: PackDisplayLabels = {};
  for (const [code, list] of Object.entries(byLocale) as [Locale, (string | undefined)[]][]) {
    if (!list) continue;
    const table: Record<string, string> = {};
    source.forEach((value, index) => {
      const label = list[index];
      if (label) table[value] = label;
    });
    if (Object.keys(table).length) labels[code] = table;
  }
  return labels;
}

/** Make an entry's texts follow the locale, in place — the pack's own language as the base. */
export function translateEntry(
  target: object,
  shadows: Partial<Record<Locale, Shadow>>,
  base: Locale,
): void {
  if (Object.keys(shadows).length) translateTree(target, shadows, base);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A plain copy of `target` with `shadow`'s strings laid over it (no getters). */
function overlay<T>(target: T, shadow: unknown): T {
  if (typeof target === "string") return (typeof shadow === "string" ? shadow : target) as T;
  if (Array.isArray(target)) {
    return target.map((item, index) =>
      overlay(item, Array.isArray(shadow) ? shadow[index] : undefined),
    ) as T;
  }
  if (!isObject(target)) return target;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target)) {
    out[key] = overlay(value, isObject(shadow) ? shadow[key] : undefined);
  }
  return out as T;
}

/**
 * The pack as read in `code` (the current locale by default): a plain copy
 * with the translated texts in place, for display — the pack's contents page.
 * Never store it: stored values (species options…) are translated too.
 */
export function translatedPackContent<
  P extends TranslatablePack & { content: Record<string, readonly { id: string }[]> },
>(pack: P, code: Locale = locale()): P["content"] {
  const translation = code === packLanguage(pack) ? undefined : pack.translations?.[code];
  if (!translation) return pack.content;
  const shadows = translation.content as Record<string, Record<string, unknown> | undefined>;
  return Object.fromEntries(
    Object.entries(pack.content).map(([kind, entries]) => [
      kind,
      entries.map((entry) => overlay(entry, shadows[kind]?.[entry.id])),
    ]),
  ) as P["content"];
}
