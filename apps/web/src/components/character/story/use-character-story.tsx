import { useCallback, useEffect, useState } from "react";
import type {
  Campaign,
  Character,
  CharacterChapter,
  JournalEntry,
} from "@adventure-keeper/schemas";

import type { SheetStory } from "@/components/character/character-sheet/types";
import { ChaptersCard } from "@/components/character/story/chapters-card";
import { JournalCard } from "@/components/character/story/journal-card";
import { PersonalityCard } from "@/components/character/story/personality-card";
import type { StoryAdventure } from "@/components/character/story/story-entry-dialog";
import { listAdventuresForPlayer } from "@/lib/adventures";
import {
  journalAdventureCount,
  listChapters,
  listCharacterCampaigns,
  listJournal,
} from "@/lib/character-story";
import type { WithId } from "@/lib/collections";
import { systemOf } from "@/systems";

/**
 * The owner's story cards — personality (5e), the chapters of their past, and
 * their journal — loaded once, for the sheet's tabs or the section below it.
 */
export function useCharacterStory(
  character: WithId<Character>,
  onCharacterChange: () => void,
): SheetStory {
  const [chapters, setChapters] = useState<WithId<CharacterChapter>[]>([]);
  const [entries, setEntries] = useState<WithId<JournalEntry>[]>([]);
  const [campaigns, setCampaigns] = useState<WithId<Campaign>[]>([]);
  const [adventures, setAdventures] = useState<StoryAdventure[]>([]);
  const { id, ownerId } = character;

  const reload = useCallback(async () => {
    const [c, j] = await Promise.all([
      listChapters(id).catch(() => [] as WithId<CharacterChapter>[]),
      listJournal(id).catch(() => [] as WithId<JournalEntry>[]),
    ]);
    setChapters(c);
    setEntries(j);
  }, [id]);

  useEffect(() => {
    void reload();
    let active = true;
    listCharacterCampaigns(ownerId, id)
      .then(async (rows) => {
        if (!active) return;
        setCampaigns(rows);
        // The adventures its owner plays in those campaigns: what an entry is filed under.
        const lists = await Promise.all(
          rows.map((campaign) => listAdventuresForPlayer(campaign.id, ownerId).catch(() => [])),
        );
        if (!active) return;
        setAdventures(
          lists.flatMap((list, index) =>
            list.map((a) => ({ id: a.id, title: a.title, campaignId: rows[index]!.id })),
          ),
        );
      })
      .catch(() => setCampaigns([]));
    return () => {
      active = false;
    };
  }, [reload, ownerId, id]);

  const system = systemOf(character);
  return {
    personality: system.personality ? (
      <PersonalityCard
        characterId={id}
        personality={system.personalityOf(character)}
        onSaved={onCharacterChange}
      />
    ) : null,
    chapters: (
      <ChaptersCard
        characterId={id}
        ownerId={ownerId}
        chapters={chapters}
        campaigns={campaigns}
        onChange={reload}
      />
    ),
    chapterCount: chapters.length,
    journal: (
      <JournalCard
        characterId={id}
        ownerId={ownerId}
        characterName={character.name}
        entries={entries}
        campaigns={campaigns}
        adventures={adventures}
        onChange={reload}
      />
    ),
    journalCount: journalAdventureCount(entries),
  };
}
