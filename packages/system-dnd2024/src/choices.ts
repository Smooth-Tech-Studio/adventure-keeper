/**
 * Player choices, described as data.
 *
 * Every point where the 2024 rules say « pick N of these » is a {@link ChoiceDef}:
 * the class's skill list, a background's tool group, a species lineage, a feat's
 * own sub-pick, the subclass, an ability-score improvement. What the player
 * settled on is a {@link ChoicePick}, stored on the sheet.
 *
 * The pair mirrors `InvocationDef` / `InvocationPick` — the def is the catalogue,
 * the pick is the decision. The difference is that a `ChoiceDef` is *generic*:
 * one UI component renders any of them, and one function resolves which are open.
 *
 * **These structures are plain, serialisable data** — ids, enums, numbers,
 * strings, arrays. No functions, no closures, no class instances: the whole set
 * is meant to become JSON later without being rewritten. Behaviour lives in the
 * pure functions at the bottom of this file, which take the data as an argument.
 *
 * A choice records the *decision*; what the decision changes lives in the
 * owning def (`LineageDef` for a lineage, `FeatDef` for a feat, and so on).
 */

import { z } from "zod";
import { ABILITIES } from "./abilities";
import { allLanguages } from "./languages";
import { SKILLS } from "./skills";
import { pick } from "./locale";

/**
 * What kind of value a choice yields. Doubles as the list of "types used on the
 * sheet" — a renderer switches on it to know what to show.
 */
export const CHOICE_KINDS = [
  /** Values are `Skill` ids. */
  "skill",
  /** Values are tool catalogue ids. */
  "tool",
  /** Values are `LanguageId`s. */
  "language",
  /** Values are spell ids (as found in the web app's `spells.json`). */
  "spell",
  /** Values are `Ability`s — ability-score improvements, casting ability. */
  "ability",
  /** Values are equipment catalogue ids. */
  "item",
  /**
   * A skill **or** a tool, mixed freely in one count — the Doué / Skilled feat
   * grants « three skills or tools, in any combination ». Values are namespaced
   * (`"skill:stealth"`, `"tool:thieves-tools"`); see {@link proficiencyValue}.
   */
  "proficiency",
  /** Values are free-form option ids: a lineage, a subclass, a feat, an equipment package. */
  "option",
] as const;
export const choiceKindSchema = z.enum(CHOICE_KINDS);
export type ChoiceKind = (typeof CHOICE_KINDS)[number];

/** Where a choice comes from — used to group them per creation step. */
export const CHOICE_SOURCES = [
  "class",
  "species",
  "background",
  "subclass",
  "feat",
  /** Opened by reaching a level (ability-score improvement, epic boon). */
  "level",
] as const;
export const choiceSourceSchema = z.enum(CHOICE_SOURCES);
export type ChoiceSource = (typeof CHOICE_SOURCES)[number];

/**
 * The values a choice allows. Three shapes, deliberately — anything richer would
 * mean interpreting expressions, which this package does not do.
 *
 * - `list` — an explicit set of ids.
 * - `any` — every value of the {@link ChoiceKind} (Human « Compétent »: any skill).
 * - `proficient` — whatever the sheet is already proficient in (Rogue expertise).
 * - `group` — one family inside a catalogue (« un instrument de musique au
 *   choix » = the `instrument` group of the tool catalogue). The group name is
 *   stored, never the member ids: the catalogues live in the web app's JSON, not
 *   in this package, and {@link ChoiceContext} resolves the family.
 */
export type ChoicePool =
  | { kind: "list"; values: readonly string[] }
  | { kind: "any" }
  | { kind: "proficient" }
  | { kind: "group"; group: string };

export const choicePoolSchema: z.ZodType<ChoicePool> = z.union([
  z.object({ kind: z.literal("list"), values: z.array(z.string().min(1)).readonly() }),
  z.object({ kind: z.literal("any") }),
  z.object({ kind: z.literal("proficient") }),
  z.object({ kind: z.literal("group"), group: z.string().min(1) }),
]);

export interface ChoiceDef {
  /**
   * Stable and unique. Convention: `"<source>:<owner>:<slug>"` —
   * `"class:druid:skills"`, `"background:artisan:tool"`, `"feat:skilled:proficiencies"`.
   */
  id: string;
  source: ChoiceSource;
  /**
   * Where this choice should be *shown*, when that differs from where it comes
   * from. A feat's own picks have `source: "feat"` wherever the feat was won,
   * but the player meets them on the step that granted it — the Acolyte's
   * cantrips belong to the background step, the level-4 feat's to the ability
   * step. Absent means « show it with its own source ».
   */
  via?: ChoiceSource;
  kind: ChoiceKind;
  /** Field label, in the engine's locale, shown as-is by the renderer. */
  label: string;
  /** How many values the player picks. */
  count: number;
  pool: ChoicePool;
  /** Character level at which the choice opens; absent = from level 1. */
  minLevel?: number;
  /** Short help under the field — our words, never rulebook prose. */
  hint?: string;
  /**
   * Another choice whose value gates this one — a Warlock Pact opening the
   * invocations that require it.
   */
  requires?: { choiceId: string; value: string };
  /**
   * The same value may be picked more than once — « +1 et +1 sur la même
   * caractéristique » is how an ability-score improvement gives +2.
   */
  allowRepeat?: boolean;
}

/** Picks the singular or the plural wording — « un élément » reads better than « 1 élément(s) ». */
function plural(count: number, one: string, many: string): string {
  return count <= 1 ? one : many;
}

/** The source whose step shows this choice — {@link ChoiceDef.via}, else its own. */
export function choiceStep(def: ChoiceDef): ChoiceSource {
  return def.via ?? def.source;
}

/** What the player settled on, stored on the sheet. */
export const choicePickSchema = z.object({
  choiceId: z.string().min(1),
  values: z.array(z.string().min(1)).max(20),
});
export type ChoicePick = z.infer<typeof choicePickSchema>;

// ===========================================================================
// Reading picks
// ===========================================================================

/** The values picked for `choiceId`, or `[]` when the choice is untouched. */
export function choiceValues(
  picks: readonly ChoicePick[] | null | undefined,
  choiceId: string,
): string[] {
  return picks?.find((pick) => pick.choiceId === choiceId)?.values ?? [];
}

/** The single value picked for `choiceId` — for `count: 1` choices. */
export function choiceValue(
  picks: readonly ChoicePick[] | null | undefined,
  choiceId: string,
): string | undefined {
  return choiceValues(picks, choiceId)[0];
}

/**
 * Every value picked across the given choices, de-duplicated. Used to feed the
 * engine: all `kind: "skill"` picks become skill proficiencies, whatever their
 * source.
 */
export function pickedValuesOfKind(
  defs: readonly ChoiceDef[],
  picks: readonly ChoicePick[] | null | undefined,
  kind: ChoiceKind,
): string[] {
  const wanted = new Set(defs.filter((def) => def.kind === kind).map((def) => def.id));
  const seen = new Set<string>();
  for (const pick of picks ?? []) {
    if (!wanted.has(pick.choiceId)) continue;
    for (const value of pick.values) seen.add(value);
  }
  return [...seen];
}

// ===========================================================================
// Mixed skill-or-tool values (`kind: "proficiency"`)
// ===========================================================================

/** The two things a `"proficiency"` value can be. */
export type ProficiencyValueKind = Extract<ChoiceKind, "skill" | "tool">;

/** `proficiencyValue("skill", "stealth")` → `"skill:stealth"`. */
export function proficiencyValue(kind: ProficiencyValueKind, id: string): string {
  return `${kind}:${id}`;
}

/** Splits `"skill:stealth"` back into its parts; `null` when the value is malformed. */
export function parseProficiencyValue(
  value: string,
): { kind: ProficiencyValueKind; id: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id || (kind !== "skill" && kind !== "tool")) return null;
  return { kind, id };
}

/**
 * The skill (or tool) ids inside a list of `"proficiency"` values — what the
 * engine needs to fold them in with the plain `"skill"` / `"tool"` picks.
 */
export function proficiencyValuesOfKind(
  values: readonly string[],
  kind: ProficiencyValueKind,
): string[] {
  return values
    .map(parseProficiencyValue)
    .filter((parsed): parsed is { kind: ProficiencyValueKind; id: string } => parsed?.kind === kind)
    .map((parsed) => parsed.id);
}

// ===========================================================================
// Resolving pools
// ===========================================================================

/**
 * What the package cannot know on its own: the tool / spell / item catalogues
 * live in the web app as lazy-loaded JSON, and what the sheet is already
 * proficient in depends on the sheet.
 */
export interface ChoiceContext {
  /** Ids already proficient, per kind — for `pool.kind === "proficient"`. */
  proficient?: Partial<Record<ChoiceKind, readonly string[]>>;
  /** Full catalogue ids per kind — for `pool.kind === "any"` on catalogue-backed kinds. */
  catalog?: Partial<Record<ChoiceKind, readonly string[]>>;
  /**
   * Catalogue ids per kind **and group** — for `pool.kind === "group"`, e.g.
   * `{ tool: { instrument: ["lute", …], artisan: [...] } }`. Built by the app
   * from the loaded catalogue (tools carry a `ToolCategory`).
   */
  catalogGroups?: Partial<Record<ChoiceKind, Record<string, readonly string[]>>>;
}

/** The kinds this package can enumerate without a catalogue (languages: the active packs' too). */
const builtInPool = (kind: ChoiceKind): readonly string[] | undefined =>
  kind === "skill"
    ? SKILLS
    : kind === "ability"
      ? ABILITIES
      : kind === "language"
        ? allLanguages().map((language) => language.id)
        : undefined;

/**
 * The concrete list of values a choice allows. An `any` pool over a
 * catalogue-backed kind (tool, spell, item) returns `[]` unless the context
 * supplies the catalogue — the renderer is then expected to load it.
 */
export function choicePoolValues(def: ChoiceDef, context: ChoiceContext = {}): string[] {
  switch (def.pool.kind) {
    case "list":
      return [...def.pool.values];
    case "proficient":
      return [...(context.proficient?.[def.kind] ?? [])];
    case "group":
      return [...(context.catalogGroups?.[def.kind]?.[def.pool.group] ?? [])];
    case "any":
      // A mixed pool is every skill plus every tool, both namespaced.
      if (def.kind === "proficiency") {
        return [
          ...SKILLS.map((skill) => proficiencyValue("skill", skill)),
          ...(context.catalog?.tool ?? []).map((tool) => proficiencyValue("tool", tool)),
        ];
      }
      return [...(builtInPool(def.kind) ?? context.catalog?.[def.kind] ?? [])];
  }
}

/**
 * `true` when `def` is open given the level and the picks made so far — its
 * `minLevel` is reached and its `requires` gate is satisfied.
 */
export function isChoiceOpen(
  def: ChoiceDef,
  level: number,
  picks: readonly ChoicePick[] | null | undefined,
): boolean {
  if (level < (def.minLevel ?? 1)) return false;
  if (!def.requires) return true;
  return choiceValues(picks, def.requires.choiceId).includes(def.requires.value);
}

// ===========================================================================
// Validation
// ===========================================================================

export type ChoiceErrorCode = "missing" | "tooMany" | "duplicate" | "outOfPool";

export interface ChoiceError {
  choiceId: string;
  code: ChoiceErrorCode;
  /** Ready-to-show message, in French. */
  message: string;
}

/**
 * Checks every open choice against its picks. An empty array means the set is
 * complete and legal.
 *
 * A pool that cannot be enumerated (an `any` pool over a catalogue the context
 * does not carry) is not checked for membership — the count rules still apply.
 */
export function validateChoices(
  defs: readonly ChoiceDef[],
  picks: readonly ChoicePick[] | null | undefined,
  level: number,
  context: ChoiceContext = {},
): ChoiceError[] {
  const errors: ChoiceError[] = [];

  for (const def of defs) {
    if (!isChoiceOpen(def, level, picks)) continue;
    const values = choiceValues(picks, def.id);

    if (values.length < def.count) {
      errors.push({
        choiceId: def.id,
        code: "missing",
        message: pick({
          fr: `${def.label} : ${plural(def.count, "choisissez un élément", `choisissez ${def.count} éléments`)} (${values.length} sur ${def.count}).`,
          en: `${def.label}: ${plural(def.count, "choose one item", `choose ${def.count} items`)} (${values.length} of ${def.count}).`,
        }),
      });
      continue;
    }
    if (values.length > def.count) {
      errors.push({
        choiceId: def.id,
        code: "tooMany",
        message: pick({
          fr: `${def.label} : ${plural(def.count, "un élément", `${def.count} éléments`)} au maximum.`,
          en: `${def.label}: ${plural(def.count, "one item", `${def.count} items`)} at most.`,
        }),
      });
    }
    if (!def.allowRepeat && new Set(values).size !== values.length) {
      errors.push({
        choiceId: def.id,
        code: "duplicate",
        message: pick({
          fr: `${def.label} : un même élément ne peut être choisi deux fois.`,
          en: `${def.label}: the same item can't be picked twice.`,
        }),
      });
    }

    const pool = choicePoolValues(def, context);
    // An empty pool means "not enumerable here", not "nothing allowed".
    if (pool.length > 0) {
      const allowed = new Set(pool);
      const stray = values.filter((value) => !allowed.has(value));
      if (stray.length > 0) {
        errors.push({
          choiceId: def.id,
          code: "outOfPool",
          message: pick({
            fr: `${def.label} : choix hors de la liste autorisée.`,
            en: `${def.label}: pick outside the allowed list.`,
          }),
        });
      }
    }
  }

  return errors;
}

/**
 * Drops picks that no longer belong — the choice disappeared (class changed), or
 * a value left the pool. Applied after any change that re-resolves the choices,
 * so the sheet never keeps a stale decision.
 */
export function pruneChoicePicks(
  defs: readonly ChoiceDef[],
  picks: readonly ChoicePick[] | null | undefined,
  level: number,
  context: ChoiceContext = {},
): ChoicePick[] {
  const byId = new Map(defs.map((def) => [def.id, def]));
  const kept: ChoicePick[] = [];

  for (const pick of picks ?? []) {
    const def = byId.get(pick.choiceId);
    if (!def || !isChoiceOpen(def, level, picks)) continue;

    const pool = choicePoolValues(def, context);
    const allowed = pool.length > 0 ? new Set(pool) : null;
    // Without the tool catalogue, a mixed pool (Doué) only knows its skills:
    // its tools are let through rather than dropped as soon as they are picked.
    const unchecked = (value: string) =>
      def.kind === "proficiency" &&
      !context.catalog?.tool &&
      parseProficiencyValue(value)?.kind === "tool";
    const values = (def.allowRepeat ? pick.values : [...new Set(pick.values)])
      .filter((value) => !allowed || allowed.has(value) || unchecked(value))
      .slice(0, def.count);

    if (values.length > 0) kept.push({ choiceId: pick.choiceId, values });
  }

  return kept;
}
