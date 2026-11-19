import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  AdventureEvent,
  CodexEntry,
  LiveSession,
  Quest,
  QuestMilestone,
  QuestStatus,
} from "@adventure-keeper/schemas";

import { tr } from "@/i18n";
import { setEventRevealed, subscribeEvents } from "@/lib/adventure-events";
import { setCodexRevealed } from "@/lib/codex";
import { isDue } from "@/lib/game-time";
import { updateQuest } from "@/lib/quests";
import { useCodex } from "@/hooks/use-codex";
import { useQuests } from "@/hooks/use-quests";
import type { WithId } from "@/lib/collections";

/** What the GM reveals during play: a planned beat, a codex entry, a quest. */
export type StoryItem =
  | {
      kind: "event";
      key: string;
      title: string;
      revealed: boolean;
      due: boolean;
      event: WithId<AdventureEvent>;
    }
  | {
      kind: "codex";
      key: string;
      title: string;
      revealed: boolean;
      due: false;
      entry: WithId<CodexEntry>;
    }
  | {
      kind: "quest";
      key: string;
      title: string;
      revealed: boolean;
      due: false;
      quest: WithId<Quest>;
    };

export type StoryKind = StoryItem["kind"];

export interface SessionStory {
  items: StoryItem[];
  /** Planned beats the game clock has reached, not revealed yet. */
  dueCount: number;
  /** Reveal or hide — with an « Annuler » in the toast. */
  toggle: (item: StoryItem) => Promise<void>;
  setQuestStatus: (quest: WithId<Quest>, status: QuestStatus) => Promise<void>;
}

/**
 * Events, codex and quests as one list for the GM's « Récit » tab, with one
 * reveal action for all three.
 */
export function useSessionStory(session: WithId<LiveSession>): SessionStory {
  const { campaignId, adventureId } = session;
  const [events, setEvents] = useState<WithId<AdventureEvent>[]>([]);
  useEffect(() => subscribeEvents(campaignId, adventureId, setEvents), [campaignId, adventureId]);
  const entries = useCodex(campaignId, true);
  const quests = useQuests(campaignId, true);
  const now = useMemo(
    () => ({ day: session.gameDay, time: session.clockLabel }),
    [session.gameDay, session.clockLabel],
  );

  const items = useMemo<StoryItem[]>(
    () => [
      ...events.map((event) => ({
        kind: "event" as const,
        key: `event:${event.id}`,
        title: event.title,
        revealed: event.isRevealed,
        due:
          !event.isRevealed &&
          (event.dueDay != null || Boolean(event.dueTime)) &&
          isDue({ day: event.dueDay, time: event.dueTime }, now),
        event,
      })),
      // A player's own quests are theirs to share: not the GM's to reveal.
      ...quests
        .filter((quest) => !quest.ownerUid)
        .map((quest) => ({
          kind: "quest" as const,
          key: `quest:${quest.id}`,
          title: quest.title,
          revealed: quest.revealed,
          due: false as const,
          quest,
        })),
      ...entries.map((entry) => ({
        kind: "codex" as const,
        key: `codex:${entry.id}`,
        title: entry.name,
        revealed: entry.revealed,
        due: false as const,
        entry,
      })),
    ],
    [events, quests, entries, now],
  );

  /** Changed from here: the quest remembers it was this session. */
  const milestone = (kind: QuestMilestone["kind"]): QuestMilestone => ({
    kind,
    adventureId,
    sessionId: session.id,
    sessionNumber: session.number,
  });

  async function write(item: StoryItem, revealed: boolean) {
    if (item.kind === "event") {
      await setEventRevealed(campaignId, adventureId, session.id, item.event, revealed);
    } else if (item.kind === "codex") {
      await setCodexRevealed(campaignId, item.entry.id, revealed);
    } else {
      // Hiding it again is a GM correction, not something that happened in play.
      await updateQuest(
        campaignId,
        item.quest.id,
        { revealed },
        revealed ? milestone("revealed") : undefined,
      );
    }
  }

  async function toggle(item: StoryItem) {
    const next = !item.revealed;
    try {
      await write(item, next);
      toast.success(
        tr(next ? "session:story.revealed" : "session:story.hidden", { title: item.title }),
        {
          action: {
            label: tr("session:story.undo"),
            onClick: () =>
              void write(item, !next).catch(() => toast.error(tr("session:story.failed"))),
          },
        },
      );
    } catch (error) {
      console.error(error);
      toast.error(tr("session:story.failed"));
    }
  }

  async function setQuestStatus(quest: WithId<Quest>, status: QuestStatus) {
    try {
      await updateQuest(campaignId, quest.id, { status }, milestone(status));
    } catch (error) {
      console.error(error);
      toast.error(tr("session:story.failed"));
    }
  }

  return { items, dueCount: items.filter((i) => i.due).length, toggle, setQuestStatus };
}
