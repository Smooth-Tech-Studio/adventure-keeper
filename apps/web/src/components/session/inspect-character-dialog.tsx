import { useState } from "react";
import { MinusIcon, PlusIcon, SparklesIcon, StarIcon } from "lucide-react";
import type { AdventureParticipant, ReadyCharacter } from "@adventure-keeper/schemas";
import {
  CONDITIONS_BY_LABEL,
  CONDITION_LABELS,
  type Condition,
} from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CharacterSheet } from "@/components/character/character-sheet";
import { SharedStory } from "@/components/character/story/shared-story";
import { useSessionActions } from "@/hooks/use-session-actions";
import type { WithId } from "@/lib/collections";

interface Props {
  characterId: string | null;
  charactersById: Record<string, WithId<ReadyCharacter>>;
  participants: WithId<AdventureParticipant>[];
  onClose: () => void;
  /** Show the condition & exhaustion controls (GM enabled it for this adventure). */
  conditionsEnabled: boolean;
}

/** GM: read-only sheet of a participant + quick XP award, inspiration, condition controls. */
export function InspectCharacterDialog({
  characterId,
  charactersById,
  participants,
  onClose,
  conditionsEnabled,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "inspect" });
  const { onAwardXp, onSetParticipantState } = useSessionActions();
  const [xpDraft, setXpDraft] = useState("");
  const character = characterId ? charactersById[characterId] : undefined;
  const participant = characterId
    ? participants.find((p) => p.characterId === characterId)
    : undefined;

  const conditions = participant?.conditions ?? [];
  const exhaustion = participant?.exhaustion ?? 0;

  return (
    <Dialog
      open={characterId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
        setXpDraft("");
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto xl:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{character?.name ?? t("character")}</DialogTitle>
        </DialogHeader>
        {character ? (
          <div className="flex flex-col gap-4">
            {participant && (
              <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SparklesIcon className="text-primary size-4 shrink-0" />
                  <span className="text-sm font-medium">{t("awardXp")}</span>
                  {[25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onAwardXp(participant.characterId, amount)}
                    >
                      +{amount}
                    </Button>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 w-24"
                      placeholder={t("other")}
                      value={xpDraft}
                      onChange={(event) => setXpDraft(event.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!Number(xpDraft)}
                      onClick={() => {
                        const value = Math.round(Number(xpDraft));
                        if (value) onAwardXp(participant.characterId, value);
                        setXpDraft("");
                      }}
                    >
                      {t("add")}
                    </Button>
                  </div>
                  {(participant.pendingXp ?? 0) > 0 && (
                    <span className="text-muted-foreground w-full text-xs">
                      {t("pendingXp", { xp: participant.pendingXp })}
                    </span>
                  )}
                </div>

                {/* 2024: the GM hands out Heroic Inspiration; the player spends it. */}
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <StarIcon className="size-4 shrink-0 text-amber-500" />
                  <span className="flex-1 text-sm font-medium">{t("inspiration")}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={participant.heroicInspiration ? "outline" : "secondary"}
                    aria-pressed={participant.heroicInspiration ?? false}
                    onClick={() =>
                      onSetParticipantState(participant.characterId, {
                        heroicInspiration: !participant.heroicInspiration,
                      })
                    }
                  >
                    {participant.heroicInspiration ? t("takeInspiration") : t("giveInspiration")}
                  </Button>
                </div>

                {conditionsEnabled && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                    <span className="text-sm font-medium">{t("conditions")}</span>
                    <ToggleGroup
                      type="multiple"
                      value={conditions}
                      onValueChange={(v) =>
                        participant &&
                        onSetParticipantState(participant.characterId, {
                          conditions: v as Condition[],
                        })
                      }
                      className="gap-1.5"
                    >
                      {CONDITIONS_BY_LABEL.map((c) => (
                        <ToggleGroupItem
                          key={c}
                          value={c}
                          className="h-7 rounded-md border px-2 text-xs"
                        >
                          {CONDITION_LABELS[c]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <span className="ml-auto flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">{t("exhaustion")}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        aria-label={t("lessExhaustion")}
                        onClick={() =>
                          onSetParticipantState(participant.characterId, {
                            exhaustion: Math.max(0, exhaustion - 1),
                          })
                        }
                      >
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="w-4 text-center font-semibold tabular-nums">
                        {exhaustion}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        aria-label={t("moreExhaustion")}
                        onClick={() =>
                          onSetParticipantState(participant.characterId, {
                            exhaustion: Math.min(6, exhaustion + 1),
                          })
                        }
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            )}
            <CharacterSheet character={character} />
            {participant && (
              <SharedStory character={character} campaignId={participant.campaignId} isGm />
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("unavailable")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
