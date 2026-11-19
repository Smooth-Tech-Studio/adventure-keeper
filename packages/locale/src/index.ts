// @adventure-keeper/locale
// The current locale and the helpers that pick a text in it. Shared by the
// rules engine and by the schemas, which label their own enumerations.

/**
 * The language the engine's texts are shown in — labels, names, summaries,
 * generated notes. Ids never change with it: the engine computes on ids, and
 * only what it hands out for display follows the locale.
 *
 * Same idea as `packs/active.ts`: every engine function is synchronous, so a
 * module-level setting is enough. The UI sets it from the interface language
 * ({@link setLocale}); a computation can borrow another one with
 * {@link withLocale}.
 *
 * French is the source language: every text is written in French first, the
 * other languages translate it, and a missing translation falls back to
 * French rather than to nothing.
 */

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

let current: Locale = "fr";

/** The locale the engine's texts currently follow. */
export function locale(): Locale {
  return current;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Make `next` the locale of every text until changed. Unknown values fall back to French. */
export function setLocale(next: string): void {
  current = isLocale(next) ? next : "fr";
}

/** Run `fn` with `next` as the locale, then restore the previous one — even if `fn` throws. */
export function withLocale<T>(next: Locale, fn: () => T): T {
  const previous = current;
  current = next;
  try {
    return fn();
  } finally {
    current = previous;
  }
}

/** One text per locale. French is required; the others fall back to it. */
export type Texts<T = string> = { fr: T } & Partial<Record<Exclude<Locale, "fr">, T>>;

/** The text for the current locale. */
export function pick<T>(texts: Texts<T>): T {
  return texts[current] ?? texts.fr;
}

/**
 * A table whose values follow the locale: `ABILITY_LABELS.str` reads « Force »
 * or « Strength ». Each key is an enumerable getter, so indexing,
 * `Object.entries` and spreading all see the current locale — and no call site
 * has to change. Every locale must cover every key (checked by the types).
 */
export function localized<K extends string>(
  byLocale: { fr: Record<K, string> } & Record<Exclude<Locale, "fr">, Record<K, string>>,
): Record<K, string> {
  const table = {} as Record<K, string>;
  for (const key of Object.keys(byLocale.fr) as K[]) {
    Object.defineProperty(table, key, {
      enumerable: true,
      get: () => byLocale[current][key] ?? byLocale.fr[key],
    });
  }
  return table;
}

/**
 * A list computed per locale and kept: `SKILLS_BY_LABEL` is sorted on the
 * labels, so its order depends on the language. Reads like a plain array.
 */
export function localizedList<T>(compute: () => T[]): T[] {
  const cache = new Map<Locale, T[]>();
  const list = () => {
    let value = cache.get(current);
    if (!value) {
      value = compute();
      cache.set(current, value);
    }
    return value;
  };
  return new Proxy([] as T[], {
    get: (_target, property) => {
      const value = Reflect.get(list(), property);
      return typeof value === "function" ? value.bind(list()) : value;
    },
    has: (_target, property) => Reflect.has(list(), property),
    ownKeys: () => Reflect.ownKeys(list()),
    getOwnPropertyDescriptor: (_target, property) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(list(), property);
      // The proxy's target is an empty array: `length` must stay non-configurable.
      if (descriptor && property === "length") descriptor.configurable = false;
      return descriptor;
    },
  });
}

/** Sort comparator on display labels, in the current locale. */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, current);
}

/**
 * The text of an object, for another locale: the same shape, keeping only
 * the strings to translate — `{ name, features: [{ summary }] }`. Arrays match
 * by position, records by key; whatever is left out stays French.
 */
export type Shadow = string | readonly Shadow[] | { readonly [key: string]: Shadow | undefined };

/**
 * Make the strings of a built-in object follow the locale, in place: each
 * string the shadow covers becomes an enumerable getter, reading the shadow
 * of the current locale — the French written in the object otherwise. The
 * object keeps its shape (plain data, `JSON.stringify`-able), so the code
 * reading it does not change.
 *
 * Only *text* belongs in a shadow. A string that is also a value — a lineage
 * stored on a sheet, an option matched by name — must stay French: translate
 * it where it is shown instead.
 */
export function translateTree(
  target: unknown,
  byLocale: Partial<Record<Locale, Shadow>>,
  /** The language the object is written in — French for built-in content, a pack's own otherwise. */
  base: Locale = "fr",
): void {
  if (!target || typeof target !== "object") return;
  const object = target as Record<string, unknown>;
  const keys = new Set<string>();
  for (const shadow of Object.values(byLocale)) {
    if (shadow && typeof shadow === "object") Object.keys(shadow).forEach((key) => keys.add(key));
  }
  for (const key of keys) {
    const at = (code: Locale) => {
      const shadow = byLocale[code];
      return shadow && typeof shadow === "object"
        ? (shadow as Record<string, Shadow | undefined>)[key]
        : undefined;
    };
    const value = object[key];
    if (typeof value === "string") {
      const source = value;
      Object.defineProperty(object, key, {
        enumerable: true,
        configurable: true,
        get: () => {
          const translated = current === base ? undefined : at(current);
          return typeof translated === "string" ? translated : source;
        },
      });
    } else if (value && typeof value === "object") {
      const nested: Partial<Record<Locale, Shadow>> = {};
      for (const code of LOCALES) {
        const shadow = at(code);
        if (shadow !== undefined) nested[code] = shadow;
      }
      translateTree(value, nested, base);
    }
  }
}

/**
 * {@link translateTree} over a list of definitions, the shadows keyed by id
 * rather than by position — robust to reordering, and readable.
 */
export function translateById<Def extends object>(
  defs: readonly Def[],
  byLocale: Partial<Record<Exclude<Locale, "fr">, Record<string, Shadow>>>,
  idOf: (def: Def) => string = (def) => (def as { id: string }).id,
): void {
  for (const def of defs) {
    const id = idOf(def);
    const shadows: Partial<Record<Locale, Shadow>> = {};
    for (const [code, table] of Object.entries(byLocale) as [Locale, Record<string, Shadow>][]) {
      if (table[id] !== undefined) shadows[code] = table[id];
    }
    translateTree(def, shadows);
  }
}
