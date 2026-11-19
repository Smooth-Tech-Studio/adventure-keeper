import { sessionNumbers } from "@adventure-keeper/schemas";

import { toMillis } from "@/lib/firestore";
import { listEndedSessions } from "@/lib/sessions";

/** A published session recap, with where it belongs — scanned for mentions. */
export interface RecapRef {
  adventureId: string;
  adventureTitle: string;
  sessionId: string;
  number: number;
  title?: string;
  text: string;
}

/**
 * Every published recap of the given adventures (the reader's), with the
 * revealed beats' descriptions folded in. One query per adventure.
 */
export async function listPublishedRecaps(
  campaignId: string,
  adventures: { id: string; title: string }[],
): Promise<RecapRef[]> {
  const perAdventure = await Promise.all(
    adventures.map(async (adventure) => {
      const sessions = await listEndedSessions(campaignId, adventure.id).catch(() => []);
      const numbers = sessionNumbers(sessions, toMillis);
      return sessions
        .filter((s) => s.recap)
        .map((s) => ({
          adventureId: adventure.id,
          adventureTitle: adventure.title,
          sessionId: s.id,
          number: numbers.get(s.id) ?? 1,
          title: s.title,
          text: [s.recap, ...(s.revealedEvents ?? []).map((e) => e.description ?? "")].join("\n"),
        }));
    }),
  );
  return perAdventure.flat();
}
