import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { PencilIcon } from "lucide-react";
import { isCharacterDraft, type Character, type ReadyCharacter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CharacterStorySection } from "@/components/character/story/character-story-section";
import { useSharedCharacterStory } from "@/components/character/story/use-shared-character-story";
import { getCampaign, getCharacter, setCharacterExperience, type WithId } from "@/lib/collections";
import { run } from "@/lib/run";
import { useAuth } from "@/hooks/use-auth";
import { crumbsFromState, useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import { systemOf } from "@/systems";
import { screensOf } from "@/systems/screens";

export function CharacterDetailPage() {
  const { t } = useTranslation(["characters", "common"]);
  const { id } = useParams<{ id: string }>();
  // Opened from a campaign: the sheet shows what the character shared with it.
  const campaignId = useSearchParams()[0].get("campaign") ?? undefined;
  const { user } = useAuth();
  const [character, setCharacter] = useState<WithId<Character> | null | "missing">(null);
  const location = useLocation();
  useBreadcrumbs([
    ...(crumbsFromState(location.state) ?? [
      { label: t("common:nav.characters"), to: "/characters" },
    ]),
    {
      label:
        character === "missing"
          ? t("detail.notFound")
          : character
            ? character.name.trim() || t("detail.untitled")
            : undefined,
    },
  ]);
  useLicenceNotice(character && character !== "missing" ? systemOf(character).licenceNotice : null);

  function reload() {
    if (!id) return;
    getCharacter(id)
      .then((row) => setCharacter(row ?? "missing"))
      .catch(() => setCharacter("missing"));
  }

  useEffect(() => {
    if (!id) return;
    let active = true;
    getCharacter(id)
      .then((row) => active && setCharacter(row ?? "missing"))
      .catch(() => active && setCharacter("missing"));
    return () => {
      active = false;
    };
  }, [id]);

  if (character === null) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }
  if (character === "missing") {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("detail.missing")}</p>
      </PageContainer>
    );
  }

  // A draft has no sheet to render: no hit points, no AC, no modifiers. Send
  // the owner back to the form instead of showing a page full of blanks.
  if (isCharacterDraft(character)) {
    return (
      <PageContainer size="narrow" className="flex flex-col items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {character.name.trim() || t("detail.untitled")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("detail.draft")}</p>
        </div>
        {character.ownerId === user?.uid && (
          <Button asChild>
            <Link to={`/characters/${character.id}/edit`}>
              <PencilIcon /> {t("detail.resume")}
            </Link>
          </Button>
        )}
      </PageContainer>
    );
  }

  const isOwner = character.ownerId === user?.uid;
  const setExperience = (xp: number) =>
    run(async () => {
      await setCharacterExperience(character.id, xp);
      reload();
    }, t("detail.xpFailed"));

  // A system whose sheet is edited in place hands its owner that sheet.
  const { OwnerSheet } = screensOf(character);
  if (isOwner && OwnerSheet) {
    return (
      <PageContainer className="[--sheet-sticky-top:3.5rem]">
        <OwnerSheet character={character} onSaved={reload} onSetExperience={setExperience} />
      </PageContainer>
    );
  }

  return (
    // The phone layout's sticky header sits under the navbar (h-14).
    <PageContainer className="[--sheet-sticky-top:3.5rem]">
      {isOwner ? (
        <>
          <CharacterSheet character={character} showEditLink onSetExperience={setExperience} />
          <CharacterStorySection character={character} onCharacterChange={reload} />
        </>
      ) : (
        <ReaderSheet character={character} campaignId={campaignId} uid={user?.uid} />
      )}
    </PageContainer>
  );
}

/**
 * Someone else's character. Reached from a campaign (`?campaign=…`), the sheet
 * shows what the character shared with it; its GM sees everything, the other
 * players neither the bag, the purse nor the XP.
 */
function ReaderSheet({
  character,
  campaignId,
  uid,
}: {
  character: WithId<ReadyCharacter>;
  campaignId?: string;
  uid?: string;
}) {
  const [isGm, setIsGm] = useState(false);
  useEffect(() => {
    if (!campaignId || !uid) return;
    getCampaign(campaignId)
      .then((campaign) => setIsGm(campaign?.ownerId === uid))
      .catch(() => setIsGm(false));
  }, [campaignId, uid]);
  const story = useSharedCharacterStory(character, campaignId, isGm);

  return (
    <CharacterSheet character={character} story={story} audience={isGm ? "gm" : "companion"} />
  );
}
