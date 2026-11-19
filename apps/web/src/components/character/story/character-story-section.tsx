import type { Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { useCharacterStory } from "@/components/character/story/use-character-story";
import type { WithId } from "@/lib/collections";

/** Below a sheet without tabs (the standard one): the character's whole story. */
export function CharacterStorySection({
  character,
  onCharacterChange,
}: {
  character: WithId<Character>;
  onCharacterChange: () => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "story" });
  const story = useCharacterStory(character, onCharacterChange);

  return (
    <section className="mt-6 flex flex-col gap-4" aria-labelledby="character-story">
      <h2 id="character-story" className="text-xl font-semibold tracking-tight">
        {t("sectionTitle")}
      </h2>
      {story.personality}
      <h3 className="mt-2 text-lg font-semibold">{t("chapters.title")}</h3>
      {story.chapters}
      <h3 className="mt-2 text-lg font-semibold">{t("journal.title")}</h3>
      {story.journal}
    </section>
  );
}
