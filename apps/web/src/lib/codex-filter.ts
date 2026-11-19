import { CODEX_KINDS, codexKey, type CodexKind } from "@adventure-keeper/schemas";

/** The GM's second filter: every entry, or only the revealed / hidden ones. */
export const CODEX_VISIBILITIES = ["all", "revealed", "hidden"] as const;
export type CodexVisibility = (typeof CODEX_VISIBILITIES)[number];

export interface CodexFilter {
  search: string;
  kind: CodexKind | "all";
  visibility: CodexVisibility;
}

interface Filterable {
  name: string;
  kind: CodexKind;
  revealed: boolean;
}

/** Read from the URL (`?type=faction&shown=hidden`); anything unknown is « all ». */
export function parseCodexFilter(params: URLSearchParams): Omit<CodexFilter, "search"> {
  const type = params.get("type");
  const shown = params.get("shown");
  return {
    kind: (CODEX_KINDS as readonly string[]).includes(type ?? "") ? (type as CodexKind) : "all",
    visibility: (CODEX_VISIBILITIES as readonly string[]).includes(shown ?? "")
      ? (shown as CodexVisibility)
      : "all",
  };
}

function matchesSearchAndVisibility(
  entry: Filterable,
  key: string,
  visibility: CodexVisibility,
): boolean {
  if (visibility === "revealed" && !entry.revealed) return false;
  if (visibility === "hidden" && entry.revealed) return false;
  return !key || codexKey(entry.name).includes(key);
}

/** The entries the filters let through. */
export function filterCodex<T extends Filterable>(entries: T[], filter: CodexFilter): T[] {
  const key = codexKey(filter.search);
  return entries.filter(
    (entry) =>
      (filter.kind === "all" || entry.kind === filter.kind) &&
      matchesSearchAndVisibility(entry, key, filter.visibility),
  );
}

/**
 * How many entries each kind chip would show, the search and visibility
 * applied — so a chip says what clicking it gives. `all` is the total.
 */
export function countCodexKinds(
  entries: Filterable[],
  filter: Omit<CodexFilter, "kind">,
): Record<CodexKind | "all", number> {
  const key = codexKey(filter.search);
  const counts = Object.fromEntries([...CODEX_KINDS, "all"].map((k) => [k, 0])) as Record<
    CodexKind | "all",
    number
  >;
  for (const entry of entries) {
    if (!matchesSearchAndVisibility(entry, key, filter.visibility)) continue;
    counts[entry.kind] += 1;
    counts.all += 1;
  }
  return counts;
}
