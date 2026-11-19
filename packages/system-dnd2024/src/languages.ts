import { z } from "zod";
import { getClass } from "./classes";
import { getSpecies } from "./species";
import { localized, pick, translateTree, type Shadow } from "./locale";
import { activeContent } from "./packs/active";
import SRD_LANGUAGES from "./srd/languages.json";

/**
 * The SRD's language ids — what a sheet stores. Their texts are in
 * `srd/languages.json`; a content pack may add languages of its own.
 */
export const LANGUAGE_IDS = [
  // Courantes / standard
  "common",
  "commonSign",
  "draconic",
  "dwarvish",
  "elvish",
  "giant",
  "gnomish",
  "goblin",
  "halfling",
  "orc",
  // Rares
  "abyssal",
  "celestial",
  "deepSpeech",
  "druidic",
  "infernal",
  "primordial",
  "sylvan",
  "thievesCant",
  "undercommon",
] as const;
export const languageIdSchema = z.enum(LANGUAGE_IDS);
export type LanguageId = (typeof LANGUAGE_IDS)[number];

export type LanguageKind = "standard" | "rare";

export const LANGUAGE_KIND_LABELS: Record<LanguageKind, string> = localized({
  fr: {
    standard: "Courante",
    rare: "Rare",
  },
  en: {
    standard: "Standard",
    rare: "Rare",
  },
});

export interface LanguageDef {
  /** A `LanguageId` for the SRD, `"pack:slug"` for a pack language. */
  id: string;
  name: string;
  kind: LanguageKind;
  /**
   * Who speaks it, and where you would hear it — the one thing the name alone
   * never tells you. Our words, never rulebook prose.
   */
  summary: string;
}

/** The SRD languages, read from `srd/languages.json` (the pack format). */
export const LANGUAGES: LanguageDef[] = SRD_LANGUAGES.entries as unknown as LanguageDef[];

{
  const english = SRD_LANGUAGES.translations.en as Record<string, Shadow>;
  LANGUAGES.forEach((language) => translateTree(language, { en: english[language.id] }));
}

export function getLanguage(id: string): LanguageDef | undefined {
  return activeContent()?.languages.get(id) ?? LANGUAGES.find((language) => language.id === id);
}

/** The SRD languages, then those of the active packs. */
export function allLanguages(): LanguageDef[] {
  const packs = activeContent()?.languages;
  return packs ? [...LANGUAGES, ...packs.values()] : LANGUAGES;
}

/** Languages every character knows. */
export const BASE_LANGUAGES: LanguageId[] = ["common"];

/** Languages the class lets the player pick on top of the origin's. */
export function classLanguagePicks(classId: string | undefined): number {
  if (!classId) return 0;
  return getClass(classId)?.languagePicks ?? 0;
}

export type LanguageSourceKind = "base" | "species" | "class";

export interface GrantedLanguage {
  /** A `LanguageId`, or `"pack:slug"` for a pack language. */
  id: string;
  sourceKind: LanguageSourceKind;
  /** Label for the source in the engine's locale, e.g. « Base », « Nain », « Druide ». */
  source: string;
}

/** Languages a character knows automatically from its base, species and class. */
export function grantedLanguages(input: {
  speciesId?: string;
  classId?: string;
}): GrantedLanguage[] {
  const out: GrantedLanguage[] = [];
  const seen = new Set<string>();
  const push = (id: string, sourceKind: LanguageSourceKind, source: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, sourceKind, source });
  };

  for (const id of BASE_LANGUAGES) push(id, "base", pick({ fr: "Base", en: "Base" }));

  if (input.speciesId) {
    const langs = getSpecies(input.speciesId)?.languages;
    if (langs) {
      const label = getSpecies(input.speciesId)?.name ?? pick({ fr: "Espèce", en: "Species" });
      for (const id of langs) push(id, "species", label);
    }
  }

  if (input.classId) {
    const langs = getClass(input.classId)?.languages;
    if (langs) {
      const label = getClass(input.classId)?.name ?? pick({ fr: "Classe", en: "Class" });
      for (const id of langs) push(id, "class", label);
    }
  }

  return out;
}
