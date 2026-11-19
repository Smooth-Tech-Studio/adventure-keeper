import { Link } from "react-router-dom";
import { HeartIcon, PencilIcon } from "lucide-react";
import type { StandardCharacter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { CropIcon } from "@/components/character/crop-icon";
import { initials } from "@/lib/format";
import type { WithId } from "@/lib/collections";
import { ItemGroup, Stat } from "@/components/character/character-sheet/primitives";

export function StandardCharacterSheet({
  character,
  showEditLink = false,
}: {
  character: WithId<StandardCharacter>;
  showEditLink?: boolean;
}) {
  const { t } = useTranslation(["sheet", "common"]);
  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-wrap items-start gap-4"
        style={
          character.color
            ? { borderLeft: `4px solid ${character.color}`, paddingLeft: 12 }
            : undefined
        }
      >
        <CropIcon
          imageUrl={character.imageUrl}
          crop={character.imageCrop}
          color={character.color}
          fallback={initials(character.name)}
          size={64}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight">{character.name}</h2>
          <p className="text-muted-foreground text-sm">{t("standard.subtitle")}</p>
        </div>
        {showEditLink && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/characters/${character.id}/edit`}>
              <PencilIcon /> {t("common:actions.edit")}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("standard.maxHp")}
          value={character.maxHitPoints}
          icon={<HeartIcon className="size-4" />}
        />
      </div>

      <CollapsibleCard
        title={t("standard.inventory")}
        titleClassName="text-base"
        storageKey="std-sheet-inventory"
        contentClassName="text-sm"
      >
        <ItemGroup title={t("standard.items")} items={character.inventory ?? []} />
        {(character.inventory ?? []).length === 0 && (
          <p className="text-muted-foreground">{t("standard.noItem")}</p>
        )}
      </CollapsibleCard>

      {character.notes?.trim() && (
        <CollapsibleCard
          title={t("standard.notes")}
          titleClassName="text-base"
          storageKey="std-sheet-notes"
        >
          <p className="text-sm whitespace-pre-wrap">{character.notes}</p>
        </CollapsibleCard>
      )}
    </div>
  );
}
