/**
 * Interface languages, with i18next.
 *
 * The texts live in `src/locales/<language>/<namespace>.json`, French being the
 * source: its files give the keys their type (see `i18next.d.ts`), and a test
 * checks every other language has the same keys. Both languages are bundled —
 * a few kilobytes each so far; a lazy backend can come once they grow.
 *
 * The language comes from, in order: the profile (`locale`, applied by
 * `LanguageSync` once signed in), the last choice on this device
 * (localStorage), the browser, then French.
 */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { setSystemsLocale } from "@/systems";

import enCommon from "@/locales/en/common.json";
import enAuth from "@/locales/en/auth.json";
import enHome from "@/locales/en/home.json";
import enProfile from "@/locales/en/profile.json";
import enCampaigns from "@/locales/en/campaigns.json";
import enAdventures from "@/locales/en/adventures.json";
import enCharacters from "@/locales/en/characters.json";
import enWizard from "@/locales/en/wizard.json";
import enSheet from "@/locales/en/sheet.json";
import enSession from "@/locales/en/session.json";
import enPacks from "@/locales/en/packs.json";
import enCodex from "@/locales/en/codex.json";
import enQuests from "@/locales/en/quests.json";
import frCommon from "@/locales/fr/common.json";
import frAuth from "@/locales/fr/auth.json";
import frHome from "@/locales/fr/home.json";
import frProfile from "@/locales/fr/profile.json";
import frCampaigns from "@/locales/fr/campaigns.json";
import frAdventures from "@/locales/fr/adventures.json";
import frCharacters from "@/locales/fr/characters.json";
import frWizard from "@/locales/fr/wizard.json";
import frSheet from "@/locales/fr/sheet.json";
import frSession from "@/locales/fr/session.json";
import frPacks from "@/locales/fr/packs.json";
import frCodex from "@/locales/fr/codex.json";
import frQuests from "@/locales/fr/quests.json";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language in its own words — never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: "Français",
  en: "English",
};

export const resources = {
  fr: {
    common: frCommon,
    auth: frAuth,
    home: frHome,
    profile: frProfile,
    campaigns: frCampaigns,
    adventures: frAdventures,
    characters: frCharacters,
    wizard: frWizard,
    sheet: frSheet,
    session: frSession,
    packs: frPacks,
    codex: frCodex,
    quests: frQuests,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    home: enHome,
    profile: enProfile,
    campaigns: enCampaigns,
    adventures: enAdventures,
    characters: enCharacters,
    wizard: enWizard,
    sheet: enSheet,
    session: enSession,
    packs: enPacks,
    codex: enCodex,
    quests: enQuests,
  },
} as const;

/** Where the device remembers the last language picked (guests included). */
const STORAGE_KEY = "ak-language";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Outside a browser (tests, scripts): French, whatever Node's locale.
    lng: typeof window === "undefined" ? "fr" : undefined,
    defaultNS: "common",
    ns: Object.keys(resources.fr),
    fallbackLng: "fr",
    supportedLngs: LANGUAGES,
    // "en-GB" from the browser resolves to "en".
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
      // Remembered as "en", not the browser's "en-US".
      convertDetectedLanguage: (language: string) => language.split("-")[0],
    },
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
  });

// The page and the rules engine (labels, names, summaries of the built-in
// content) follow the interface language.
function applyLanguage() {
  const language = currentLanguage();
  if (typeof document !== "undefined") document.documentElement.lang = language;
  setSystemsLocale(language);
}
applyLanguage();
i18n.on("languageChanged", applyLanguage);

/**
 * The interface language right now, for code outside React (sorting,
 * formatting, error messages). Components use `useTranslation()` instead, so
 * they re-render on a change.
 */
export function currentLanguage(): Language {
  const language = i18n.resolvedLanguage ?? i18n.language;
  return isLanguage(language) ? language : "fr";
}

/**
 * `text` translated when it is a key, as is otherwise. For messages written
 * far from React — a Zod schema's `"validation.emailRequired"` — while the
 * forms not yet translated still pass plain French.
 */
export function translateKey(text: string): string {
  return i18n.exists(text) ? String(i18n.t(text as never)) : text;
}

/**
 * A translation looked up by a key built at run time (`wizard:substeps.${key}.nav`),
 * which the typed `t()` cannot check. Warns in development when the key is
 * missing, rather than showing it silently.
 */
export function tr(key: string, values?: Record<string, unknown>): string {
  if (import.meta.env?.DEV && !i18n.exists(key)) console.warn(`[i18n] missing key ${key}`);
  return String(i18n.t(key as never, values as never));
}

export default i18n;
