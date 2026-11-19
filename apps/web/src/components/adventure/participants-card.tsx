import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  memberCharacterIds,
  type AdventureParticipant,
  type CampaignMember,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { CharacterSheetLink } from "@/components/character/character-sheet-link";
import { Label } from "@/components/ui/label";
import { addParticipant, removeParticipant } from "@/lib/adventures";
import {
  getCharacter,
  getCompanionSheet,
  readyCharacterOrNull,
  withFreshDerived,
  type WithId,
} from "@/lib/collections";
import type { Crumb } from "@/hooks/use-breadcrumbs";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";

interface Props {
  campaignId: string;
  adventureId: string;
  isGm: boolean;
  participants: WithId<AdventureParticipant>[];
  members: WithId<CampaignMember>[];
  /** Breadcrumbs back to the adventure, for the sheet a name opens. */
  from?: Crumb[];
  onChange: () => void | Promise<void>;
}

export function ParticipantsCard({
  campaignId,
  adventureId,
  isGm,
  participants,
  members,
  from,
  onChange,
}: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [busy, setBusy] = useState(false);

  // One character per player and adventure: a player already taking part is
  // not offered again. The GM picks which of the player's characters plays.
  const playing = new Set(participants.map((p) => p.playerId));
  const addableMembers = members.filter(
    (m) => m.role === "player" && !playing.has(m.uid) && memberCharacterIds(m).length > 0,
  );

  // The names of the characters on offer — sheets are readable by anyone signed in.
  const [names, setNames] = useState<Record<string, string>>({});
  const profiles = useUserProfiles(addableMembers.map((member) => member.uid));
  const offeredKey = addableMembers.flatMap((m) => memberCharacterIds(m)).join(",");
  useEffect(() => {
    if (!isGm || !offeredKey) return;
    let cancelled = false;
    Promise.all(
      offeredKey.split(",").map(async (id) => {
        const character = await getCompanionSheet(id);
        return [id, character?.name || t("participants.untitled")] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setNames(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` only names a missing sheet
  }, [isGm, offeredKey]);

  async function addMemberAsParticipant(member: WithId<CampaignMember>, characterId: string) {
    setBusy(true);
    try {
      // Equipment / inventory live on the character sheet, not the participant.
      // Standard equipment is folded in by the player from the adventure page
      // (owner-side write) — the GM cannot write another player's sheet.
      // A member can only have picked a finished sheet, but the read is typed
      // as « any character » — narrow rather than assume.
      const loaded = readyCharacterOrNull(await getCharacter(characterId));
      const character = loaded ? withFreshDerived(loaded) : null;
      await addParticipant(campaignId, adventureId, {
        characterId,
        playerId: member.uid,
        characterName: character?.name ?? member.displayName,
        currentHitPoints: character?.maxHitPoints,
      });
      await onChange();
    } catch (error) {
      console.error(error);
      toast.error(t("participants.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <UsersIcon className="size-4" /> {t("participants.title")}
        </span>
      }
      storageKey="adv-participants"
      summary={
        participants.length > 0
          ? participants.map((p) => p.characterName).join(" · ")
          : t("participants.none")
      }
      action={
        participants.length > 0 ? (
          <Badge variant="secondary">{participants.length}</Badge>
        ) : undefined
      }
      contentClassName="flex flex-col gap-3"
    >
      {participants.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("participants.none")}</p>
      )}
      <ul className="flex flex-col gap-2">
        {participants.map((participant) => (
          <li
            key={participant.id}
            className="bg-muted/30 flex items-center gap-2 rounded-md border p-2 text-sm"
          >
            <CharacterSheetLink
              characterId={participant.characterId}
              campaignId={campaignId}
              from={from}
              className="flex-1 font-medium hover:underline"
            >
              {participant.characterName}
            </CharacterSheetLink>
            {participant.currentHitPoints !== undefined && (
              <Badge variant="secondary">
                {t("common:stats.hp", { value: participant.currentHitPoints })}
              </Badge>
            )}
            {isGm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8"
                aria-label={t("participants.remove")}
                onClick={() =>
                  removeParticipant(
                    campaignId,
                    adventureId,
                    participant.characterId,
                    participant.playerId,
                  ).then(onChange)
                }
              >
                <Trash2Icon className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isGm && addableMembers.length > 0 && (
        <div className="grid gap-2">
          <Label className="text-xs">{t("participants.addPlayer")}</Label>
          {addableMembers.map((member) => {
            const roster = memberCharacterIds(member);
            return (
              <div key={member.uid} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground min-w-24 text-sm">
                  {nameOf(profiles, member.uid, member.displayName)}
                </span>
                {roster.map((characterId) => (
                  <Button
                    key={characterId}
                    type="button"
                    variant={characterId === member.characterId ? "outline" : "ghost"}
                    size="sm"
                    disabled={busy}
                    onClick={() => addMemberAsParticipant(member, characterId)}
                  >
                    <PlusIcon /> {names[characterId] ?? "…"}
                    {roster.length > 1 && characterId === member.characterId && (
                      <span className="text-muted-foreground text-xs">
                        {t("participants.active")}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {isGm &&
        addableMembers.length === 0 &&
        members.some((m) => m.role === "player" && !playing.has(m.uid)) && (
          <p className="text-muted-foreground text-xs">{t("participants.othersMustPick")}</p>
        )}
    </CollapsibleCard>
  );
}
