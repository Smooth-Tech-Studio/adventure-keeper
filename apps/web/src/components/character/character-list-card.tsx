import { Link } from "react-router-dom";
import { HeartIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { isCharacterDraft, type Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CropIcon } from "@/components/character/crop-icon";
import type { WithId } from "@/lib/collections";
import { initials } from "@/lib/format";
import { systemOf } from "@/systems";
import { screensOf } from "@/systems/screens";

/**
 * A sheet in « Mes personnages »: portrait, name and line, edit and delete;
 * then its HP, proficiency, alignment, background and abilities — or, for a
 * draft, what is left to do.
 */
export function CharacterListCard({
  character,
  onDelete,
}: {
  character: WithId<Character>;
  onDelete: () => void;
}) {
  const { t } = useTranslation(["characters", "common"]);
  const draft = isCharacterDraft(character);
  const { listLine, ListBadges, ListFigures } = screensOf(character);
  // A draft has no sheet to show — its only destination is the form.
  const target = draft ? `/characters/${character.id}/edit` : `/characters/${character.id}`;
  return (
    <Card style={character.color ? { borderLeft: `4px solid ${character.color}` } : undefined}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Link to={target} className="flex min-w-0 flex-1 items-start gap-3">
            <CropIcon
              imageUrl={character.imageUrl}
              crop={character.imageCrop}
              color={character.color}
              fallback={initials(character.name || "?")}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate hover:underline">
                {character.name?.trim() || (
                  <span className="text-muted-foreground italic">{t("list.untitled")}</span>
                )}
              </CardTitle>
              <CardDescription>
                {draft
                  ? t("list.draftLine", { system: systemOf(character).label })
                  : listLine(character)}
              </CardDescription>
            </div>
          </Link>
          <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
            <Link to={`/characters/${character.id}/edit`} aria-label={t("common:actions.edit")}>
              <PencilIcon className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-8 shrink-0"
            aria-label={t("common:actions.delete")}
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {draft ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t("list.draft")}</Badge>
            <span className="text-muted-foreground">{t("list.draftHint")}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <HeartIcon /> {t("common:stats.hp", { value: character.maxHitPoints })}
              </Badge>
              {ListBadges && <ListBadges character={character} />}
            </div>
            {ListFigures && <ListFigures character={character} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
