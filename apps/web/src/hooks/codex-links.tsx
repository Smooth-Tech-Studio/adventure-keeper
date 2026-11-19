import { useMemo, type ReactNode } from "react";

import { CodexLinksContext, codexPath } from "@/hooks/use-codex";
import { mentionResolver } from "@/lib/codex-mentions";

/**
 * Lets every `Markdown` below turn `[[Nom]]` into a link to the codex entry —
 * among the entries this reader knows.
 */
export function CodexLinksProvider({
  campaignId,
  entries,
  children,
}: {
  campaignId: string;
  entries: { id: string; name: string }[];
  children: ReactNode;
}) {
  const resolver = useMemo(
    () => mentionResolver(entries, (id) => codexPath(campaignId, id)),
    [entries, campaignId],
  );
  return <CodexLinksContext.Provider value={resolver}>{children}</CodexLinksContext.Provider>;
}
