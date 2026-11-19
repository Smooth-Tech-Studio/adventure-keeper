import type { ComponentProps } from "react";
import { CircleDashedIcon, HeartIcon, TriangleAlertIcon } from "lucide-react";
import {
  memberCharacterIds,
  type CampaignMember,
  type ReadyCharacter,
  type UserProfile,
} from "@adventure-keeper/schemas";
import { packContentOf } from "@/systems/dnd2024/lib/character-storage";
import { packText } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { CharacterSheetLink } from "@/components/character/character-sheet-link";
import { CropIcon } from "@/components/character/crop-icon";
import { UserAvatar } from "@/components/user-avatar";
import type { WithId } from "@/lib/collections";
import { characterSubtitle } from "@/lib/character-subtitle";
import { initials } from "@/lib/format";

/** Where a character's name leads: its sheet, with the breadcrumbs back. */
type SheetLink = Omit<ComponentProps<typeof CharacterSheetLink>, "className" | "children">;

/**
 * A player in the party: their character's portrait (or their own avatar),
 * its name opening the sheet, who plays it, the other characters they brought,
 * its max HP. The GM also sees the packs the campaign doesn't allow.
 */
export function MemberRow({
  member,
  player,
  profile,
  sheets,
  isGm,
  allowedPacks,
  sheetLink,
}: {
  member: CampaignMember;
  /** The player's current name. */
  player: string;
  /** The player's profile, for their avatar while no character is picked. */
  profile?: Pick<UserProfile, "photoURL" | "photoCrop">;
  /** The sheets loaded so far, by character id. */
  sheets: Readonly<Record<string, WithId<ReadyCharacter>>>;
  isGm: boolean;
  /** Packs the GM allowed: a sheet using another one is flagged. */
  allowedPacks: ReadonlySet<string>;
  sheetLink: (characterId: string) => SheetLink;
}) {
  const { t } = useTranslation("campaigns");
  const [activeId, ...otherIds] = memberCharacterIds(member);
  const sheet = activeId ? sheets[activeId] : undefined;
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {sheet ? (
        <CropIcon
          imageUrl={sheet.imageUrl}
          crop={sheet.imageCrop}
          color={sheet.color}
          fallback={initials(sheet.name || "?")}
          size={40}
        />
      ) : (
        <UserAvatar
          name={player}
          photoURL={profile?.photoURL}
          photoCrop={profile?.photoCrop}
          size={40}
        />
      )}
      <div className="min-w-0 flex-1 text-sm">
        {activeId ? (
          <CharacterSheetLink
            {...sheetLink(activeId)}
            className="font-medium underline-offset-4 hover:underline"
          >
            {sheet?.name || t("members.pickedCharacter")}
          </CharacterSheetLink>
        ) : (
          <span className="font-medium">{player}</span>
        )}
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {activeId
            ? [sheet && characterSubtitle(sheet), t("members.playedBy", { name: player })]
                .filter(Boolean)
                .join(" · ")
            : t("members.noCharacter")}
        </p>
        {otherIds.length > 0 && (
          <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
            {t("members.alsoPlays")}
            {otherIds.map((id) => (
              <CharacterSheetLink key={id} {...sheetLink(id)} className="hover:underline">
                {sheets[id]?.name ?? t("members.pickedCharacter")}
              </CharacterSheetLink>
            ))}
          </p>
        )}
      </div>
      {isGm &&
        packContentOf(sheet ? [sheet] : [])
          .filter((pack) => !allowedPacks.has(pack.id))
          .map((pack) => (
            <Badge
              key={pack.id}
              variant="outline"
              className="border-amber-500/60 text-amber-700 dark:text-amber-400"
            >
              <TriangleAlertIcon /> {t("members.packNotAllowed", { name: packText(pack, "name") })}
            </Badge>
          ))}
      {sheet ? (
        <span
          className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums"
          title={t("members.maxHp")}
        >
          <HeartIcon className="size-3.5" /> {sheet.maxHitPoints}
        </span>
      ) : (
        isGm &&
        !activeId && (
          <Badge variant="outline" className="text-muted-foreground">
            <CircleDashedIcon /> {t("members.waiting")}
          </Badge>
        )
      )}
    </li>
  );
}
