import { codexKey } from "@adventure-keeper/schemas";

/** Where a `[[Nom]]` mention leads, when the reader knows the entry. */
export type MentionResolver = (name: string) => string | null;

/**
 * Turn `[[Nom]]` mentions into Markdown links the reader can follow: to the
 * codex entry when they know it, plain text otherwise (so an unrevealed name
 * never gives away that an entry exists).
 */
export function linkMentions(text: string, resolve: MentionResolver): string {
  return text.replace(/\[\[([^[\]\n]{1,160})\]\]/g, (_, raw: string) => {
    const name = raw.trim();
    const href = resolve(name);
    const label = name.replace(/([[\]\\])/g, "\\$1");
    return href ? `[${label}](${href})` : label;
  });
}

/** Resolver over a list of entries, matching names without case or accents. */
export function mentionResolver(
  entries: { id: string; name: string }[],
  hrefOf: (id: string) => string,
): MentionResolver {
  const byKey = new Map(entries.map((e) => [codexKey(e.name), e.id]));
  return (name) => {
    const id = byKey.get(codexKey(name));
    return id ? hrefOf(id) : null;
  };
}

/** Whether a text mentions the entry (`[[Nom]]`, any case or accents). */
export function mentions(text: string | undefined, name: string): boolean {
  if (!text) return false;
  const key = codexKey(name);
  return [...text.matchAll(/\[\[([^[\]\n]{1,160})\]\]/g)].some((m) => codexKey(m[1]!) === key);
}
