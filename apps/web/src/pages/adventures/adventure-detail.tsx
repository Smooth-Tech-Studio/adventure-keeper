import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ADVENTURE_STATUS_LABELS,
  LIVE_SESSION_STATUS_LABELS,
  adventureCanReturnToDraft,
  adventureIsPlayable,
  adventureStatusSchema,
  playerCanReadAdventure,
  type Adventure,
  type AdventureStatus,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { DangerZone } from "@/components/danger-zone";
import { PageContainer } from "@/components/page-container";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { EnemiesCard } from "@/components/adventure/enemies-card";
import { LocationsCard } from "@/components/adventure/locations-card";
import { NpcsCard } from "@/components/adventure/npcs-card";
import { ParticipantsCard } from "@/components/adventure/participants-card";
import { ChronicleCard } from "@/components/adventure/chronicle-card";
import { AdventureStartCard } from "@/components/adventure/adventure-start-card";
import { EventsCard } from "@/components/adventure/events-card";
import { deleteAdventure, listAdventures, updateAdventure } from "@/lib/adventures";
import { exportAdventureFile } from "@/lib/campaign-file";
import { ExportFileButton } from "@/components/campaign/export-file-button";
import type { WithId } from "@/lib/collections";
import { markRecapSeen } from "@/lib/recap-seen";
import { startLiveSession } from "@/lib/sessions";
import { RealtimeStartDialog } from "@/components/session/realtime-start-dialog";
import { useAdventureDetail } from "@/hooks/use-adventure-detail";
import { CodexLinksProvider } from "@/hooks/codex-links";
import { useCodex } from "@/hooks/use-codex";
import { useAuth } from "@/hooks/use-auth";
import { useCampaignPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { campaignLicenceNotice, useLicenceNotice } from "@/hooks/use-licence-notice";

export function AdventureDetailPage() {
  const { t } = useTranslation(["adventures", "common", "campaigns"]);
  const { id: campaignId, adventureId } = useParams<{ id: string; adventureId: string }>();
  // The campaign's packs: their monsters are offered for enemies.
  useCampaignPacks(campaignId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    campaign,
    adventure,
    members,
    locations,
    participants,
    enemyList,
    npcList,
    eventList,
    session,
    endedSessions,
    reload,
  } = useAdventureDetail(campaignId, adventureId, user?.uid);

  const [busy, setBusy] = useState(false);
  // `[[Nom]]` in the chronicle links to the codex entries this reader knows.
  const codex = useCodex(campaign ? campaignId : undefined, campaign?.ownerId === user?.uid);

  // Opening the adventure counts as reading its latest recap (campaign badge).
  const lastRecapAt = typeof adventure === "object" ? adventure?.lastRecapAt : undefined;
  useEffect(() => {
    if (adventureId && lastRecapAt) markRecapSeen(adventureId, lastRecapAt);
  }, [adventureId, lastRecapAt]);

  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: campaign?.name, to: `/campaigns/${campaignId}` },
    {
      label:
        adventure === "missing"
          ? t("detail.notFound")
          : adventure === "error"
            ? t("detail.error")
            : adventure?.title,
    },
  ]);
  useLicenceNotice(campaignLicenceNotice(campaign));

  if (adventure === "missing") {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("detail.missing")}</p>
      </PageContainer>
    );
  }
  if (adventure === "error") {
    return (
      <PageContainer className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">{t("detail.loadFailed")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
          {t("common:actions.retry")}
        </Button>
      </PageContainer>
    );
  }
  if (!adventure || !campaign || !user || !campaignId || !adventureId) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  const isGm = campaign.ownerId === user.uid;

  /** Start on Firestore, or through the realtime server at `realtimeUrl`. */
  async function startSession(realtimeUrl?: string) {
    setBusy(true);
    const { status, startDay, startTime, startDate } = adventure as WithId<Adventure>;
    try {
      const sessionId = await startLiveSession(
        campaignId!,
        adventureId!,
        user!.uid,
        status,
        { day: startDay, time: startTime, date: startDate },
        realtimeUrl,
      );
      navigate(`/campaigns/${campaignId}/adventures/${adventureId}/session/${sessionId}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("ADVENTURE_BUSY:")) {
        toast.error(t("detail.busy", { title: message.slice("ADVENTURE_BUSY:".length) }));
      } else if (message === "ADVENTURE_DRAFT") {
        toast.error(t("detail.draftNotPlayable"));
      } else {
        toast.error(t("detail.startFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: AdventureStatus) {
    // Once an adventure has been played it can never go back to "brouillon".
    if (status === "draft" && !adventureCanReturnToDraft(adventure as WithId<Adventure>)) {
      toast.error(t("detail.cannotReturnToDraft"));
      return;
    }
    // A campaign runs at most one adventure "en cours" at a time.
    if (status === "active") {
      const siblings = await listAdventures(campaignId!).catch(() => []);
      const busyAdventure = siblings.find(
        (a) => a.id !== adventureId && (a.status === "active" || Boolean(a.liveSessionId)),
      );
      if (busyAdventure) {
        toast.error(t("detail.alreadyActive", { title: busyAdventure.title }));
        return;
      }
    }
    try {
      await updateAdventure(campaignId!, adventureId!, { status });
      await reload();
    } catch (error) {
      console.error(error);
      toast.error(t("detail.statusFailed"));
    }
  }

  async function removeAdventure() {
    setBusy(true);
    try {
      await deleteAdventure(campaignId!, adventureId!);
      toast.success(t("detail.deleted"));
      navigate(`/campaigns/${campaignId}`, { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("detail.deleteFailed"));
      setBusy(false);
    }
  }

  const liveSessionId = adventure.liveSessionId ?? session?.id;
  const isParticipant = (adventure.playerIds ?? []).includes(user.uid);

  // A non-GM cannot see an adventure they don't take part in, or a draft.
  if (!isGm && (!isParticipant || adventure.status === "draft")) {
    return (
      <PageContainer size="narrow" className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.inaccessible")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("detail.notParticipant")}</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Between sessions a participating player reads the chronicle only: the
  // adventure's content opens once it is completed or a session is live.
  const canReadContent = isGm || playerCanReadAdventure(adventure);
  // Players come for the story: it leads their page. The GM prepares first.
  const chronicle = (
    <ChronicleCard
      campaignId={campaignId}
      campaignName={campaign.name}
      adventureId={adventureId}
      adventureTitle={adventure.title}
      isGm={isGm}
      userId={user.uid}
      sessions={endedSessions}
      participants={participants}
      onChange={reload}
    />
  );

  return (
    <CodexLinksProvider campaignId={campaignId} entries={codex}>
      <PageContainer className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{adventure.title}</h1>
            {adventure.summary && (
              <p className="text-muted-foreground mt-1 text-sm">{adventure.summary}</p>
            )}
            {isGm && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Label className="text-muted-foreground text-xs">{t("detail.status")}</Label>
                <Select
                  value={adventure.status}
                  onValueChange={(v) => changeStatus(v as AdventureStatus)}
                >
                  <SelectTrigger className="h-8 w-40" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adventureStatusSchema.options.map((s) => (
                      <SelectItem
                        key={s}
                        value={s}
                        disabled={s === "draft" && !adventureCanReturnToDraft(adventure)}
                      >
                        {ADVENTURE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ExportFileButton
                  label={t("campaigns:export.adventure")}
                  name={adventure.title}
                  load={() => exportAdventureFile(campaignId!, adventureId!)}
                />
                {adventure.status === "draft" && (
                  <span className="text-muted-foreground w-full text-xs">
                    {t("detail.draftHint")}
                  </span>
                )}
              </div>
            )}
          </div>
          {liveSessionId ? (
            <Button asChild>
              <Link
                to={`/campaigns/${campaignId}/adventures/${adventureId}/session/${liveSessionId}`}
              >
                <PlayIcon />{" "}
                {t("detail.liveJoin", {
                  status: session ? LIVE_SESSION_STATUS_LABELS[session.status] : t("detail.live"),
                })}
              </Link>
            </Button>
          ) : (
            isGm &&
            adventureIsPlayable(adventure) && (
              <div className="flex gap-1.5">
                <Button onClick={() => startSession()} disabled={busy}>
                  <PlayIcon /> {t("detail.start")}
                </Button>
                <RealtimeStartDialog
                  campaignId={campaignId!}
                  disabled={busy}
                  onStart={(url) => void startSession(url)}
                />
              </div>
            )
          )}
        </div>

        {/* The adventure's content on the left; who plays it and the GM's settings on the right. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {!isGm && chronicle}
            {!canReadContent && (
              <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                {t("detail.notYet")}
              </p>
            )}
            {isGm && (
              <EventsCard
                campaignId={campaignId}
                adventureId={adventureId}
                events={eventList}
                onChange={reload}
              />
            )}
            {canReadContent && (
              <>
                <LocationsCard
                  campaignId={campaignId}
                  adventureId={adventureId}
                  isGm={isGm}
                  locations={locations}
                  onChange={reload}
                />
                <EnemiesCard
                  campaignId={campaignId}
                  adventureId={adventureId}
                  isGm={isGm}
                  enemies={enemyList}
                  locations={locations}
                  onChange={reload}
                />
                <NpcsCard
                  campaignId={campaignId}
                  adventureId={adventureId}
                  isGm={isGm}
                  npcs={npcList}
                  locations={locations}
                  enemies={enemyList}
                  onChange={reload}
                />
              </>
            )}
            {isGm && chronicle}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <ParticipantsCard
              campaignId={campaignId}
              adventureId={adventureId}
              isGm={isGm}
              participants={participants}
              members={members}
              from={[
                { label: t("common:nav.campaigns"), to: "/campaigns" },
                { label: campaign.name, to: `/campaigns/${campaignId}` },
                {
                  label: adventure.title,
                  to: `/campaigns/${campaignId}/adventures/${adventureId}`,
                },
              ]}
              onChange={reload}
            />
            {isGm && (
              <AdventureStartCard
                campaignId={campaignId}
                adventureId={adventureId}
                adventure={adventure}
                onChange={reload}
              />
            )}
            {isGm && (
              <CollapsibleCard
                title={t("detail.optionalRules")}
                storageKey="adv-optional-rules"
                summary={adventure.conditionsEnabled ? t("detail.conditionsOn") : t("detail.none")}
              >
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={adventure.conditionsEnabled ?? false}
                    onCheckedChange={(checked) =>
                      updateAdventure(campaignId!, adventureId!, {
                        conditionsEnabled: checked === true,
                      })
                        .then(reload)
                        .catch(() => toast.error(t("detail.actionFailed")))
                    }
                  />
                  <span>
                    {t("detail.conditions")}
                    <span className="text-muted-foreground block text-xs">
                      {t("detail.conditionsHint")}
                    </span>
                  </span>
                </label>
              </CollapsibleCard>
            )}

            {isGm && (
              <DangerZone
                actions={[
                  {
                    label: t("detail.delete"),
                    description: t("detail.deleteDescription"),
                    disabled: Boolean(liveSessionId),
                    disabledReason: t("detail.deleteDisabled"),
                    confirmTitle: t("detail.deleteConfirmTitle", { title: adventure.title }),
                    confirmDescription: t("detail.deleteConfirm"),
                    onConfirm: removeAdventure,
                  },
                ]}
              />
            )}
          </div>
        </div>
      </PageContainer>
    </CodexLinksProvider>
  );
}
