import { SparklesIcon } from "lucide-react";
import type { AdventureParticipant, Dnd2024Character } from "@adventure-keeper/schemas";
import { levelForXp } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/** XP the GM awarded, waiting to be cashed in — and the level-up it opens. */
export function XpBanner({
  character,
  participant,
  onCashInXp,
  onApplyLevel,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onCashInXp?: () => void;
  onApplyLevel?: (level: number) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "sheet" });
  const level = character.level ?? 1;
  const suggestedLevel = levelForXp(character.experiencePoints ?? 0);
  const canLevelUp = suggestedLevel > level && !!onApplyLevel;
  const pendingXp = participant.pendingXp ?? 0;
  if (pendingXp <= 0 && !canLevelUp) return null;

  return (
    <div className="border-primary/40 bg-primary/5 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
      <SparklesIcon className="text-primary size-3.5 shrink-0" />
      {pendingXp > 0 && (
        <span className="flex items-center gap-2">
          {t("xpAwarded")}
          {onCashInXp && (
            <Button type="button" size="sm" className="h-6 px-2" onClick={onCashInXp}>
              {t("cashIn")}
            </Button>
          )}
        </span>
      )}
      {canLevelUp && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-6 px-2"
          onClick={() => onApplyLevel(suggestedLevel)}
        >
          {t("levelUp")}
        </Button>
      )}
    </div>
  );
}
