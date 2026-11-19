import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  Adventure,
  Campaign,
  CampaignMember,
  CampaignPack,
  Character,
} from "@adventure-keeper/schemas";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { PageContainer } from "@/components/page-container";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  AdventuresCard,
  CurrentAdventure,
  LiveBar,
} from "@/components/campaign/campaign-adventures";
import { CampaignHeader } from "@/components/campaign/campaign-header";
import { MembersCard } from "@/components/campaign/members-card";
import { MyCharacterCard } from "@/components/campaign/my-character-card";
import { PrepCard } from "@/components/campaign/prep-card";
import { CodexCard } from "@/components/codex/codex-card";
import { QuestsCard } from "@/components/quests/quests-card";
import { CampaignPacksCard } from "@/components/campaign/campaign-packs-card";
import {
  listCampaignMembers,
  subscribeAdventures,
  subscribeAdventuresForPlayer,
} from "@/lib/adventures";
import {
  deleteCampaign,
  getCampaign,
  listMyCharacters,
  renameCampaign,
  type WithId,
} from "@/lib/collections";
import { currentAdventure, useAdventurePlays } from "@/hooks/use-adventure-plays";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useCodex } from "@/hooks/use-codex";
import { campaignLicenceNotice, useLicenceNotice } from "@/hooks/use-licence-notice";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useQuestEditor } from "@/hooks/use-quest-editor";
import { useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { subscribeCampaignPacks } from "@/systems/dnd2024/lib/packs";
import { packContentOf } from "@/systems/dnd2024/lib/character-storage";

type CampaignTab = "adventures" | "quests" | "codex" | "party" | "prep";

/**
 * A campaign: on a computer, a dashboard — the adventure in progress first,
 * then adventures, quests, codex and the GM's preparation, the party on the
 * right; on a phone, the same in tabs, one thing at a time.
 */
export function CampaignDetailPage() {
  const { t } = useTranslation(["campaigns", "common"]);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const wide = useMediaQuery("(min-width: 1024px)");
  // Arriving from « choisissez votre personnage »: the party's tab, on a phone.
  const [tab, setTab] = useState<CampaignTab>(hash === "#my-character" ? "party" : "adventures");
  const [campaign, setCampaign] = useState<WithId<Campaign> | null | "missing">(null);
  const [members, setMembers] = useState<WithId<CampaignMember>[]>([]);
  const [adventures, setAdventures] = useState<WithId<Adventure>[]>([]);
  const [myCharacters, setMyCharacters] = useState<WithId<Character>[]>([]);
  const [campaignPacks, setCampaignPacks] = useState<WithId<CampaignPack>[]>([]);

  const reload = useCallback(async () => {
    if (!id || !user) return;
    const [c, m, chars] = await Promise.all([
      getCampaign(id),
      listCampaignMembers(id),
      listMyCharacters(user.uid),
    ]);
    setCampaign(c ?? "missing");
    setMembers(m);
    setMyCharacters(chars);
  }, [id, user]);

  useEffect(() => {
    reload().catch((error) => {
      console.error(error);
      setCampaign("missing");
    });
  }, [reload]);

  // Adventures live-subscribe so the "Rejoindre" button appears as soon as a
  // session goes live. Players only get the adventures they take part in.
  useEffect(() => {
    if (!id || !user || !campaign || campaign === "missing") return;
    const gm = campaign.ownerId === user.uid;
    return gm
      ? subscribeAdventures(id, setAdventures)
      : subscribeAdventuresForPlayer(id, user.uid, setAdventures);
  }, [id, user, campaign]);

  // Packs the GM allowed: listed on the page, and visible to the lookups so
  // members' pack species and backgrounds resolve.
  const loaded = Boolean(campaign && campaign !== "missing");
  useEffect(() => {
    if (!id || !loaded) return;
    return subscribeCampaignPacks(id, setCampaignPacks);
  }, [id, loaded]);
  useRegisterPacks(campaignPacks.map((copy) => copy.pack));
  const isGm = loaded && campaign !== "missing" && campaign?.ownerId === user?.uid;
  // Quests and codex once the reader's role is known: their counts name the phone's tabs.
  const questEditor = useQuestEditor(loaded && id ? id : "", {
    isGm,
    uid: user?.uid ?? "",
    name: myCharacters[0]?.name ?? user?.displayName ?? "",
  });
  const codex = useCodex(loaded ? id : undefined, isGm);
  const plays = useAdventurePlays(id ?? "", adventures);
  // My own sheets' copies, for the character card and picker.
  useRegisterPacks(packContentOf(myCharacters));
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: campaign === "missing" ? t("detail.notFound") : campaign?.name },
  ]);
  useLicenceNotice(campaignLicenceNotice(campaign === "missing" ? null : campaign));

  if (campaign === "missing") {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("detail.missing")}</p>
      </PageContainer>
    );
  }
  if (!campaign || !user) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  const myMember = members.find((m) => m.uid === user.uid);

  async function rename(name: string) {
    if (!id) return;
    try {
      await renameCampaign(id, name);
      toast.success(t("detail.renamed"));
      await reload();
    } catch (error) {
      console.error(error);
      toast.error(t("detail.renameFailed"));
      throw error;
    }
  }

  async function removeCampaign() {
    if (!id) return;
    try {
      await deleteCampaign(id);
      toast.success(t("detail.deleted"));
      navigate("/campaigns", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("detail.deleteFailed"));
    }
  }

  const players = members.filter((member) => member.role !== "gm");
  const gmMember = members.find((member) => member.role === "gm");
  const current = currentAdventure(adventures);
  const live = adventures.some((adventure) => adventure.liveSessionId);
  const openQuests = questEditor.quests.filter(
    (quest) => quest.status === "rumor" || quest.status === "active",
  ).length;
  const reader = {
    isGm,
    uid: user.uid,
    // A player signs their quests with their character here.
    name: myCharacters[0]?.name ?? user.displayName ?? "",
  };

  const hero = current && (
    <CurrentAdventure
      campaignId={campaign.id}
      adventure={current}
      plays={plays[current.id]}
      isGm={isGm}
    />
  );
  const cards = (titled: boolean) => ({
    adventures: (
      <AdventuresCard
        campaignId={campaign.id}
        adventures={adventures}
        plays={plays}
        isGm={isGm}
        titled={titled}
      />
    ),
    quests: (
      <QuestsCard
        campaignId={campaign.id}
        reader={reader}
        editor={questEditor}
        codex={codex}
        adventureTitles={Object.fromEntries(adventures.map((a) => [a.id, a.title]))}
        titled={titled}
      />
    ),
    codex: <CodexCard campaignId={campaign.id} isGm={isGm} entries={codex} titled={titled} />,
    prep: isGm && <PrepCard campaignId={campaign.id} userId={user.uid} titled={titled} />,
    myCharacter: myMember && !isGm && (
      <MyCharacterCard
        campaign={campaign}
        member={myMember}
        myCharacters={myCharacters}
        onChanged={reload}
      />
    ),
    party: (
      <MembersCard
        campaign={campaign}
        members={members}
        me={user}
        isGm={isGm}
        campaignPacks={campaignPacks}
        titled={titled}
      />
    ),
    packs: <CampaignPacksCard campaign={campaign} packs={campaignPacks} isGm={isGm} me={user} />,
  });
  const header = (
    <CampaignHeader
      campaign={campaign}
      isGm={isGm}
      gmName={gmMember?.displayName}
      live={live}
      onRename={rename}
      onDelete={removeCampaign}
    >
      {/* Off the adventures' tab, the live session stays in sight under the header. */}
      {!wide && tab !== "adventures" && current && (
        <LiveBar campaignId={campaign.id} adventure={current} isGm={isGm} compact />
      )}
    </CampaignHeader>
  );

  if (wide) {
    // A computer: one page, the adventure in progress first; the party on the right.
    const c = cards(true);
    return (
      <PageContainer className="flex flex-col gap-5">
        {header}
        <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-5">
          <div className="flex min-w-0 flex-col gap-4">
            {hero}
            {c.adventures}
            {c.quests}
            {c.codex}
            {c.prep}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {c.myCharacter}
            {c.party}
            {c.packs}
          </div>
        </div>
      </PageContainer>
    );
  }

  // A phone: one thing at a time, in tabs, each with its count.
  const c = cards(false);
  const tabs: { id: CampaignTab; label: string; count?: number; body: ReactNode }[] = [
    {
      id: "adventures",
      label: t("detail.adventures"),
      count: adventures.length,
      body: (
        <>
          {hero}
          {c.adventures}
        </>
      ),
    },
    { id: "quests", label: t("detail.tabs.quests"), count: openQuests, body: c.quests },
    { id: "codex", label: t("detail.tabs.codex"), count: codex.length, body: c.codex },
    {
      id: "party",
      label: t("detail.tabs.party"),
      count: players.length,
      body: (
        <>
          {c.myCharacter}
          {c.party}
          {c.packs}
        </>
      ),
    },
    ...(isGm ? [{ id: "prep" as const, label: t("prep.title"), body: c.prep }] : []),
  ];
  return (
    <PageContainer className="flex flex-col gap-4">
      {header}
      <Tabs value={tab} onValueChange={(value) => setTab(value as CampaignTab)} className="gap-4">
        <TabsList
          variant="line"
          className="-mx-4 w-auto overflow-x-auto px-4 [scrollbar-width:none]"
        >
          {tabs.map(({ id, label, count }) => (
            <TabsTrigger key={id} value={id}>
              {label}
              {count !== undefined && (
                <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ id, body }) => (
          <TabsContent key={id} value={id} className="flex flex-col gap-4">
            {body}
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
