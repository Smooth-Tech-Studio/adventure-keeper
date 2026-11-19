/**
 * Moving built-in content into a pack: a sheet that used `"aasimar"` or the
 * `"tough"` feat must now say `"<pack>:aasimar"`, `"<pack>:tough"` — in its
 * own fields, in the values it picked **and** in the ids of the choices those
 * entries opened (`"species:aasimar:size"`, `"feat:crafter:tools"`), then carry
 * the pack entries it uses (`packContent`).
 *
 * An entry's former id is its slug, except for subclasses: the code named them
 * `"druid:cercle-de-la-lune"`, a pack calls them `"druid-cercle-de-la-lune"`.
 */

import type { ChoicePick } from "../choices";
import { mergeContentPacks, packEntryId } from "./registry";
import type { ContentPack } from "./schema";
import { extractUsedContent } from "./snapshot";

/** What a character (finished or draft) stores that can point at content. */
export interface MigratableSheet {
  speciesId?: string;
  backgroundId?: string;
  cantrips?: string[];
  spells?: string[];
  toolProficiencies?: string[];
  toolExpertise?: string[];
  /** Carried items: a tool picked from the catalogue keeps its `catalogId`. */
  tools?: { catalogId?: string }[];
  inventory?: { catalogId?: string }[];
  choices?: ChoicePick[];
  packContent?: ContentPack[];
}

export interface MigrateOptions {
  /**
   * `false`: only rename the ids and leave `packContent` as it was — the sheet
   * then reads the entries from a pack its owner has (library, campaign), and
   * its own copy is written by the app on its next save. Default `true`.
   */
  copyContent?: boolean;
}

/** The id the code knew a subclass by, before it moved to a pack. */
export function legacySubclassId(entry: { id: string; classId: string }): string {
  const prefix = `${entry.classId}-`;
  return entry.id.startsWith(prefix)
    ? `${entry.classId}:${entry.id.slice(prefix.length)}`
    : entry.id;
}

interface IdMap {
  /** Whole-value replacements: field values and picked values. */
  values: Map<string, string>;
  /** Choice-id prefixes: `"species:aasimar:"` → `"species:<pack>:aasimar:"`. */
  prefixes: [string, string][];
  species: Map<string, string>;
  backgrounds: Map<string, string>;
}

function idMap(pack: ContentPack): IdMap {
  const ns = (slug: string) => packEntryId(pack.id, slug);
  const species = new Map(pack.content.species.map((e) => [e.id, ns(e.id)] as const));
  const backgrounds = new Map(pack.content.backgrounds.map((e) => [e.id, ns(e.id)] as const));
  const feats = new Map(pack.content.feats.map((e) => [e.id, ns(e.id)] as const));
  const values = new Map<string, string>([
    ...feats,
    ...pack.content.spells.map((e) => [e.id, ns(e.id)] as const),
    ...pack.content.subclasses.map((e) => [legacySubclassId(e), ns(e.id)] as const),
    ...pack.content.tools.map((e) => [e.id, ns(e.id)] as const),
  ]);
  const prefixes: [string, string][] = [
    ...[...species].map(([old, now]): [string, string] => [`species:${old}:`, `species:${now}:`]),
    ...[...backgrounds].map(([old, now]): [string, string] => [
      `background:${old}:`,
      `background:${now}:`,
    ]),
    ...[...feats].map(([old, now]): [string, string] => [`feat:${old}:`, `feat:${now}:`]),
  ];
  return { values, prefixes, species, backgrounds };
}

function renameChoice(choiceId: string, map: IdMap): string {
  for (const [old, now] of map.prefixes) {
    if (choiceId.startsWith(old)) return now + choiceId.slice(old.length);
  }
  return choiceId;
}

/**
 * Point `sheet` at `pack` for every entry the pack took over, and refresh its
 * `packContent`. `changed` is `false` when the sheet used none of them — leave
 * it alone then.
 */
export function migrateSheetToPack<T extends MigratableSheet>(
  sheet: T,
  pack: ContentPack,
  { copyContent = true }: MigrateOptions = {},
): { changed: boolean; sheet: T & { packContent?: ContentPack[] } } {
  const map = idMap(pack);
  let changed = false;
  const value = (id: string) => {
    const now = map.values.get(id);
    if (now) changed = true;
    return now ?? id;
  };

  const speciesId = sheet.speciesId && map.species.get(sheet.speciesId);
  const backgroundId = sheet.backgroundId && map.backgrounds.get(sheet.backgroundId);
  if (speciesId || backgroundId) changed = true;

  const choices = sheet.choices?.map((pick) => {
    const choiceId = renameChoice(pick.choiceId, map);
    if (choiceId !== pick.choiceId) changed = true;
    return { choiceId, values: pick.values.map(value) };
  });
  const cantrips = sheet.cantrips?.map(value);
  const spells = sheet.spells?.map(value);
  const toolProficiencies = sheet.toolProficiencies?.map(value);
  const toolExpertise = sheet.toolExpertise?.map(value);
  const item = <I extends { catalogId?: string }>(it: I): I =>
    it.catalogId ? { ...it, catalogId: value(it.catalogId) } : it;
  const tools = sheet.tools?.map(item);
  const inventory = sheet.inventory?.map(item);
  if (!changed) return { changed, sheet };

  const next: T = {
    ...sheet,
    ...(speciesId ? { speciesId } : {}),
    ...(backgroundId ? { backgroundId } : {}),
    ...(choices ? { choices } : {}),
    ...(cantrips ? { cantrips } : {}),
    ...(spells ? { spells } : {}),
    ...(toolProficiencies ? { toolProficiencies } : {}),
    ...(toolExpertise ? { toolExpertise } : {}),
    ...(tools ? { tools } : {}),
    ...(inventory ? { inventory } : {}),
  };
  if (!copyContent) return { changed, sheet: next };
  const used = [
    next.speciesId,
    next.backgroundId,
    ...(next.cantrips ?? []),
    ...(next.spells ?? []),
    ...(next.toolProficiencies ?? []),
    ...(next.choices ?? []).flatMap((pick) => pick.values),
  ].filter((id): id is string => Boolean(id));
  const sources = mergeContentPacks([pack, ...(sheet.packContent ?? [])]);
  return { changed, sheet: { ...next, packContent: extractUsedContent(sources, used) } };
}
