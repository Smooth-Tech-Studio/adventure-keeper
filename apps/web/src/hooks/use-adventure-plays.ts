import { useEffect, useState } from "react";
import type { Adventure } from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";
import { loadAdventurePlays, type AdventurePlays } from "@/lib/sessions";

/** Sessions played, the last one and its recap, for each adventure — loaded once per list. */
export function useAdventurePlays(campaignId: string, adventures: WithId<Adventure>[]) {
  const [plays, setPlays] = useState<Record<string, AdventurePlays>>({});
  // Reloaded when an adventure is added, goes live, or gets a new recap.
  const key = adventures
    .map((a) => `${a.id}:${a.liveSessionId ?? ""}:${a.lastRecapAt ?? ""}`)
    .join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(
      key.split(",").map(async (entry) => {
        const id = entry.split(":")[0];
        // A locked adventure may not be readable: it simply shows no session.
        const found = await loadAdventurePlays(campaignId, id).catch(() => ({ played: 0 }));
        return [id, found] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setPlays(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);
  return plays;
}

/** The adventure the table plays now: the live one, else the first in progress. */
export function currentAdventure(adventures: WithId<Adventure>[]) {
  return (
    adventures.find((adventure) => adventure.liveSessionId) ??
    adventures.find((adventure) => adventure.status === "active")
  );
}
