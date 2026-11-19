import { useEffect, useState } from "react";
import type { Character, CharacterChapter, JournalEntry } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import type { SheetStory } from "@/components/character/character-sheet/types";
import { ChapterArticle } from "@/components/character/story/chapters-card";
import { JournalByAdventure } from "@/components/character/story/journal-card";
import { PersonalityView } from "@/components/character/story/personality-card";
import {
  journalAdventureCount,
  listSharedChapters,
  listSharedJournal,
} from "@/lib/character-story";
import type { WithId } from "@/lib/collections";
import { systemOf } from "@/systems";

/**
 * Another player's character read from a campaign: the personality, and the
 * chapters and journal entries shared with that campaign's party — or with
 * its GM. Read-only; absent without a campaign to read from.
 */
export function useSharedCharacterStory(
  character: WithId<Character>,
  campaignId: string | undefined,
  isGm: boolean,
): SheetStory | undefined {
  const { t } = useTranslation("characters", { keyPrefix: "story" });
  const [chapters, setChapters] = useState<WithId<CharacterChapter>[]>([]);
  const [entries, setEntries] = useState<WithId<JournalEntry>[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    Promise.all([
      listSharedChapters(character.id, campaignId, isGm),
      listSharedJournal(character.id, campaignId, isGm),
    ])
      .then(([c, j]) => {
        if (cancelled) return;
        setChapters(c);
        setEntries(j);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [character.id, campaignId, isGm]);

  if (!campaignId) return undefined;
  const personality = systemOf(character).personalityOf(character);

  return {
    personality: personality ? <PersonalityView personality={personality} /> : null,
    chapters: (
      <div className="grid gap-3">
        {chapters.map((chapter) => (
          <ChapterArticle key={chapter.id} chapter={chapter} />
        ))}
        {chapters.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("shared.noChapter")}</p>
        )}
      </div>
    ),
    chapterCount: chapters.length,
    journal: (
      <div className="grid gap-3">
        <JournalByAdventure entries={entries} />
        {entries.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("shared.noEntry")}</p>
        )}
      </div>
    ),
    journalCount: journalAdventureCount(entries),
  };
}
