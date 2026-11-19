import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileTextIcon, LockIcon, PlusIcon, ShieldIcon, StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  memberCharacterIds,
  type Adventure,
  type Campaign,
  type CampaignMember,
  type Character,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { CharacterPicker } from "@/components/campaign/character-picker";
import { CropIcon } from "@/components/character/crop-icon";
import { loadCharacterHolds } from "@/lib/adventures";
import { characterSubtitle } from "@/lib/character-subtitle";
import { systemOf } from "@/systems";
import {
  readyCharacters,
  removeMemberCharacter,
  setMemberCharacter,
  type WithId,
} from "@/lib/collections";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

interface MyCharacterCardProps {
  campaign: WithId<Campaign>;
  /** The signed-in player's member doc. */
  member: WithId<CampaignMember>;
  /** Every character the player owns. */
  myCharacters: WithId<Character>[];
  /** Refetch campaign + members after a change. */
  onChanged: () => Promise<void>;
}

/**
 * The characters the signed-in player brought into this campaign. One is
 * active — offered to the GM for the next adventures — and switching is free:
 * an adventure in progress keeps the character it started with. Adding a
 * character never drops the others; removing one waits for the adventure in
 * progress it plays in to end (see `character-lock.ts`).
 */
export function MyCharacterCard({
  campaign,
  member,
  myCharacters,
  onChanged,
}: MyCharacterCardProps) {
  const { t } = useTranslation(["campaigns", "common"]);
  const { hash } = useLocation();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holds, setHolds] = useState<Record<string, WithId<Adventure> | null>>({});

  const ready = readyCharacters(myCharacters);
  const roster = memberCharacterIds(member).flatMap((id) => {
    const character = ready.find((entry) => entry.id === id);
    return character ? [character] : [];
  });
  const rosterKey = roster.map((character) => character.id).join(",");
  const picking = roster.length === 0 || adding;

  // Arriving from the "choisissez votre personnage" notification.
  useEffect(() => {
    if (hash === "#my-character") {
      document.getElementById("my-character")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  useEffect(() => {
    if (!rosterKey) return;
    let cancelled = false;
    loadCharacterHolds(campaign.id, member.uid, rosterKey.split(","))
      .then((next) => {
        if (!cancelled) setHolds(next);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [campaign.id, member.uid, rosterKey]);

  async function run(action: () => Promise<void>, success: string) {
    setSaving(true);
    try {
      await action();
      toast.success(success);
      setAdding(false);
      await onChanged();
    } catch (error) {
      console.error(error);
      toast.error(t("myCharacter.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const choose = (characterId: string) =>
    run(
      () => setMemberCharacter(campaign.id, member.uid, characterId),
      roster.length === 0 ? t("myCharacter.chosen") : t("myCharacter.added"),
    );

  return (
    <CampaignCard
      id="my-character"
      title={roster.length > 1 ? t("myCharacter.titleMany") : t("myCharacter.titleOne")}
      icon={ShieldIcon}
      className={cn(roster.length === 0 && "border-primary/50 bg-primary/5")}
      contentClassName="flex flex-col gap-4"
    >
      {roster.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("myCharacter.introNone")}</p>
      )}
      {roster.length > 0 && (
        <ul className="flex flex-col gap-3">
          {roster.map((character) => {
            const active = character.id === member.characterId;
            const stats = systemOf(character).combatStats(character);
            const heldBy = holds[character.id] ?? null;
            return (
              <li key={character.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <CropIcon
                    imageUrl={character.imageUrl}
                    crop={character.imageCrop}
                    color={character.color}
                    fallback={initials(character.name || "?")}
                    size={active ? 48 : 36}
                  />
                  {/* Wide enough for the name: in the campaign's side column the buttons wrap below. */}
                  <div className="min-w-40 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {character.name}
                      {active && roster.length > 1 && (
                        <Badge variant="secondary">{t("myCharacter.active")}</Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {characterSubtitle(character)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to={`/characters/${character.id}`}
                        state={{
                          from: [
                            { label: t("common:nav.campaigns"), to: "/campaigns" },
                            { label: campaign.name, to: `/campaigns/${campaign.id}` },
                          ],
                        }}
                      >
                        <FileTextIcon /> {t("myCharacter.viewSheet")}
                      </Link>
                    </Button>
                    {!active && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          run(
                            () => setMemberCharacter(campaign.id, member.uid, character.id),
                            t("myCharacter.nowActive", { name: character.name }),
                          )
                        }
                      >
                        <StarIcon /> {t("myCharacter.makeActive")}
                      </Button>
                    )}
                    {roster.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving || heldBy !== null}
                        aria-label={t("myCharacter.removeLabel", { name: character.name })}
                        onClick={() =>
                          run(
                            () => removeMemberCharacter(campaign.id, member, character.id),
                            t("myCharacter.left", { name: character.name }),
                          )
                        }
                      >
                        <Trash2Icon /> {t("myCharacter.remove")}
                      </Button>
                    )}
                  </div>
                </div>
                {active && stats.armorClass !== undefined && (
                  <dl className="grid grid-cols-3 gap-1.5 text-center">
                    {(
                      [
                        [t("myCharacter.maxHp"), character.maxHitPoints],
                        [t("myCharacter.ac"), stats.armorClass],
                        [t("myCharacter.initiative"), signed(stats.initiativeBonus)],
                      ] as [string, string | number][]
                    ).map(([label, value]) => (
                      // The term first for screen readers, the number on top on screen.
                      <div
                        key={label}
                        className="bg-muted/50 flex flex-col-reverse rounded-lg border px-1 py-1.5"
                      >
                        <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                          {label}
                        </dt>
                        <dd className="text-base font-bold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {heldBy && (
                  <p className="text-muted-foreground flex gap-2 text-sm">
                    <LockIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {t("myCharacter.plays", { name: character.name, adventure: heldBy.title })}
                      {active ? t("myCharacter.playsActiveEnd") : t("myCharacter.playsInactiveEnd")}
                      {roster.length > 1 && t("myCharacter.lockedUntilEnd")}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {roster.length > 0 && !adding && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <PlusIcon /> {t("myCharacter.add")}
        </Button>
      )}

      {picking && (
        <>
          <CharacterPicker
            characters={myCharacters.filter(
              (character) => !roster.some((entry) => entry.id === character.id),
            )}
            characterSystem={campaign.characterSystem}
            onSelect={choose}
            returnTo={`/campaigns/${campaign.id}`}
            disabled={saving}
          />
          {adding && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setAdding(false)}
            >
              {t("common:actions.cancel")}
            </Button>
          )}
        </>
      )}
    </CampaignCard>
  );
}
