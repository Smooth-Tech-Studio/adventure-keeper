import { useEffect, useState } from "react";
import type { Character, CharacterChapter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { ChapterArticle } from "@/components/character/story/chapters-card";
import { PersonalityView } from "@/components/character/story/personality-card";
import { listSharedChapters } from "@/lib/character-story";
import type { WithId } from "@/lib/collections";
import { systemOf } from "@/systems";

/**
 * Another player's character seen from a campaign: their personality and the
 * chapters of their past shared with this campaign's party — or with its GM.
 */
export function SharedStory({
  character,
  campaignId,
  isGm,
}: {
  character: WithId<Character>;
  campaignId: string;
  isGm: boolean;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "story" });
  const [chapters, setChapters] = useState<WithId<CharacterChapter>[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSharedChapters(character.id, campaignId, isGm)
      .then((rows) => !cancelled && setChapters(rows))
      .catch((error) => {
        console.error(error);
        if (!cancelled) setChapters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [character.id, campaignId, isGm]);

  const personality = systemOf(character).personalityOf(character);
  if (!personality && (chapters ?? []).length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3" aria-label={t("sectionTitle")}>
      <h2 className="font-semibold">{t("sectionTitle")}</h2>
      {personality && <PersonalityView personality={personality} />}
      {(chapters ?? []).map((chapter) => (
        <ChapterArticle key={chapter.id} chapter={chapter} />
      ))}
    </section>
  );
}
