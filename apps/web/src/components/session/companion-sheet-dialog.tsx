import type { ReadyCharacter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CharacterSheet } from "@/components/character/character-sheet";
import { useSharedCharacterStory } from "@/components/character/story/use-shared-character-story";
import type { WithId } from "@/lib/collections";

/**
 * A companion's sheet, read-only, over the session: what a fellow player sees
 * of it (no bag, purse nor XP) and the story shared with this campaign.
 */
export function CompanionSheetDialog({
  character,
  campaignId,
  onClose,
}: {
  character: WithId<ReadyCharacter> | null;
  campaignId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  return (
    <Dialog open={character !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto xl:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{character?.name ?? t("companionSheet")}</DialogTitle>
        </DialogHeader>
        {character && <CompanionSheet character={character} campaignId={campaignId} />}
      </DialogContent>
    </Dialog>
  );
}

function CompanionSheet({
  character,
  campaignId,
}: {
  character: WithId<ReadyCharacter>;
  campaignId: string;
}) {
  const story = useSharedCharacterStory(character, campaignId, false);
  return <CharacterSheet character={character} story={story} audience="companion" />;
}
