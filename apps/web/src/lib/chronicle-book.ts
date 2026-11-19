import {
  sessionNumbers,
  type AdventureParticipant,
  type JournalEntry,
  type LiveSession,
  type Quest,
  type SessionQuote,
} from "@adventure-keeper/schemas";

import { listSessionJournal } from "@/lib/character-story";
import { toMillis } from "@/lib/firestore";
import { listQuotes } from "@/lib/session-memory";
import { listEndedSessions, listMapReveals } from "@/lib/sessions";
import { sessionFacts } from "@/lib/recap";
import type { WithId } from "@/lib/collections";
import type { ChronicleChapter } from "@/lib/chronicle-markdown";

export type { ChronicleChapter } from "@/lib/chronicle-markdown";

/**
 * The adventure as a book: every session whose recap is published, oldest
 * first, with what it holds. Only what every member may read: party journal
 * entries the GM did not hide, never drafts or secrets.
 */
export async function loadChronicle(
  campaignId: string,
  adventureId: string,
  participants: WithId<AdventureParticipant>[],
  quests: readonly Pick<Quest, "title" | "milestones">[] = [],
): Promise<ChronicleChapter[]> {
  const ended = await listEndedSessions(campaignId, adventureId);
  const numbers = sessionNumbers(ended, toMillis);
  const published = ended
    .filter((s) => s.recap)
    .sort((a, b) => toMillis(a.startedAt) - toMillis(b.startedAt));

  return Promise.all(
    published.map(async (session: WithId<LiveSession>) => {
      const [reveals, quotes, journals] = await Promise.all([
        session.visitedLocationIds?.length
          ? listMapReveals(campaignId, adventureId, session.id).catch(() => [])
          : Promise.resolve([]),
        listQuotes(campaignId, adventureId, session.id).catch(() => [] as WithId<SessionQuote>[]),
        listSessionJournal(campaignId, session.id, false).catch(() => [] as WithId<JournalEntry>[]),
      ]);
      const facts = sessionFacts(session, participants, reveals, quests);
      const hidden = new Set(session.hiddenEntryIds ?? []);
      return {
        sessionId: session.id,
        number: numbers.get(session.id) ?? 1,
        title: session.title,
        playedAt: toMillis(session.startedAt),
        endedAt: toMillis(session.endedAt) || undefined,
        gameDay: session.gameDay,
        gameDate: session.gameDate,
        recap: session.recap ?? "",
        attendees: facts.attendees,
        places: facts.places,
        events: (session.revealedEvents ?? []).map((e) => ({
          title: e.title,
          description: e.description,
        })),
        documents: (session.shownDocuments ?? []).map((d) => d.name),
        loot: facts.loot,
        defeated: facts.defeated,
        quests: facts.quests,
        quotes: quotes.map((q) => ({ text: q.text, speaker: q.speaker })),
        journals: journals
          .filter((j) => !hidden.has(j.id))
          .map((j) => ({ characterName: j.characterName, title: j.title, body: j.body })),
      };
    }),
  );
}
