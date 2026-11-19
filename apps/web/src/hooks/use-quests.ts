import { useEffect, useState } from "react";
import type { Quest } from "@adventure-keeper/schemas";

import { subscribeQuests } from "@/lib/quests";
import type { WithId } from "@/lib/collections";

/**
 * The quests this reader may see, live: all for the GM; for a player the
 * revealed ones, plus their own personal quests when `uid` is given.
 */
export function useQuests(campaignId: string | undefined, isGm: boolean, uid?: string) {
  const [quests, setQuests] = useState<WithId<Quest>[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    return subscribeQuests(campaignId, isGm, setQuests, uid);
  }, [campaignId, isGm, uid]);
  return quests;
}
