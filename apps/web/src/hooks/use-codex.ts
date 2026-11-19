import { createContext, useContext, useEffect, useState } from "react";
import type { CodexEntry } from "@adventure-keeper/schemas";

import { subscribeCodex } from "@/lib/codex";
import type { MentionResolver } from "@/lib/codex-mentions";
import type { WithId } from "@/lib/collections";

/** Set by `CodexLinksProvider`: how `[[Nom]]` mentions resolve for this reader. */
export const CodexLinksContext = createContext<MentionResolver | null>(null);

export const codexPath = (campaignId: string, entryId?: string) =>
  `/campaigns/${campaignId}/codex${entryId ? `?entry=${entryId}` : ""}`;

/** The codex entries this reader may see, live (all for the GM, revealed for players). */
export function useCodex(campaignId: string | undefined, isGm: boolean) {
  const [entries, setEntries] = useState<WithId<CodexEntry>[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    return subscribeCodex(campaignId, isGm, setEntries);
  }, [campaignId, isGm]);
  return entries;
}

export function useCodexLinks(): MentionResolver | null {
  return useContext(CodexLinksContext);
}
