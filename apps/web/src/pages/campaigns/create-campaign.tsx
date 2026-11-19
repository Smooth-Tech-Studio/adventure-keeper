import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  GAME_SYSTEM_LABELS,
  parseCampaignFile,
  type Campaign,
  type CampaignFile,
  type CharacterSystem,
  type GameSystem,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { ImportGuide } from "@/components/campaign/import-guide";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/page-container";
import { Textarea } from "@/components/ui/textarea";
import { InvitePlayers } from "@/components/campaign/members-card";
import { GuidedFlow, type FlowStep } from "@/components/wizard/guided-flow";
import { ImportStart } from "@/components/wizard/import-start";
import { OptionCard } from "@/components/wizard/option-card";
import { fileCounts, importCampaignContent } from "@/lib/campaign-file";
import { createCampaign, getCampaign, type WithId } from "@/lib/collections";
import { packName, packSummary } from "@/systems/dnd2024/lib/pack-labels";
import { activatePackInCampaign } from "@/systems/dnd2024/lib/packs";
import { characterSystemFor, getSystem } from "@/systems";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useContentPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { useFullWidthPage } from "@/hooks/use-full-width-page";

/** Systems that need a name of their own (« Mon système maison »). */
const NAMED_SYSTEMS: ReadonlySet<GameSystem> = new Set(["custom", "other"]);

/**
 * `/campaigns/new` — the campaign, one question per screen: its name and
 * pitch, the game (which decides the character sheets), the content packs, a last look, then
 * the invitations once it exists.
 */
export function CreateCampaignPage() {
  const { t } = useTranslation(["campaigns", "common"]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { myPacks, sharedPacks } = useContentPacks();
  useFullWidthPage(true);
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: t("create.title") },
  ]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState<GameSystem>("dnd5e");
  const [systemLabel, setSystemLabel] = useState("");
  const [characterSystem, setCharacterSystem] = useState<CharacterSystem>(
    characterSystemFor("dnd5e"),
  );
  const [packIds, setPackIds] = useState<ReadonlySet<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [campaign, setCampaign] = useState<WithId<Campaign> | null>(null);
  /** Starting from a campaign file: what it holds, or what is wrong with it. */
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{
    fileName: string;
    file?: CampaignFile;
    errors: string[];
  } | null>(null);
  const file = importing ? imported?.file : undefined;

  const library = [...myPacks, ...sharedPacks];
  // Packs extend the 5E sheet; a free sheet has nothing to take from them.
  const offersPacks = getSystem(characterSystem).contentPacks && library.length > 0;
  const needsLabel = NAMED_SYSTEMS.has(system);
  const chosenPacks = library.filter((pack) => packIds.has(pack.id));
  const missingPacks = (file?.packs ?? []).filter(
    (ref) => !library.some((pack) => pack.packId === ref.id),
  );

  /** Read a campaign file, and let it answer the questions that follow. */
  function readFile(fileName: string, text: string) {
    const result = parseCampaignFile(text);
    if (!result.ok) {
      setImported({ fileName, errors: result.errors });
      return;
    }
    const { campaign: c, packs } = result.file;
    setImported({ fileName, file: result.file, errors: [] });
    setName(c.name);
    setDescription(c.description ?? "");
    setSystem(c.system);
    setSystemLabel(c.systemLabel ?? "");
    setCharacterSystem(c.characterSystem);
    setPackIds(
      new Set(
        library.filter((pack) => packs.some((ref) => ref.id === pack.packId)).map((p) => p.id),
      ),
    );
  }

  async function create(): Promise<boolean> {
    if (!user) return false;
    setBusy(true);
    try {
      const id = await createCampaign(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          system,
          systemLabel: needsLabel ? systemLabel.trim() || undefined : undefined,
          characterSystem,
        },
        { uid: user.uid, displayName: user.displayName, email: user.email },
      );
      const me = { uid: user.uid, displayName: user.displayName, email: user.email };
      const results = await Promise.allSettled(
        (offersPacks ? chosenPacks : []).map((pack) => activatePackInCampaign(id, pack, me)),
      );
      if (results.some((r) => r.status === "rejected" || !r.value.ok)) {
        toast.warning(t("create.packsPartial"));
      }
      const failures = file ? await importCampaignContent(id, file, user.uid) : 0;
      setCampaign(await getCampaign(id));
      if (failures > 0) toast.warning(t("create.importPartial", { count: failures }));
      else toast.success(t("create.created"));
      return true;
    } catch (error) {
      console.error(error);
      toast.error(t("create.failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const counts = file ? fileCounts(file.adventures) : null;
  const contentLine =
    file && counts
      ? t("create.importedContent", {
          adventures: counts.adventures,
          locations: counts.locations,
          enemies: counts.enemies,
          npcs: counts.npcs,
          codex: file.codex.length,
          quests: file.quests.length,
        })
      : "";

  const steps: FlowStep[] = [
    {
      id: "start",
      label: t("create.steps.start"),
      title: t("create.startTitle"),
      lead: t("create.startLead"),
      why: t("create.startWhy"),
      value: file ? (imported?.fileName ?? "") : t("create.blank"),
      issues: importing && !file ? [t("create.importNeeded")] : [],
      content: (
        <ImportStart
          importing={importing}
          onImportingChange={setImporting}
          blankTitle={t("create.blank")}
          blankHint={t("create.blankHint")}
          importTitle={t("create.importFile")}
          importHint={t("create.importFileHint")}
          onFile={readFile}
          fileName={imported?.fileName}
          errors={imported?.errors ?? []}
          warnings={missingPacks.map((ref) =>
            t("create.missingPack", { name: ref.name ?? ref.id }),
          )}
          summary={
            file && (
              <p className="text-sm">
                <span className="font-medium">{file.campaign.name}</span> — {contentLine}
              </p>
            )
          }
          guide={<ImportGuide kind="campaign" />}
        />
      ),
    },
    {
      id: "pitch",
      label: t("create.steps.pitch"),
      title: t("create.pitchTitle"),
      lead: t("create.pitchLead"),
      why: t("create.pitchWhy"),
      value: name.trim(),
      issues: name.trim() ? [] : [t("create.nameRequired")],
      content: (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="campaign-name">{t("create.name")}</Label>
            <Input
              id="campaign-name"
              autoFocus
              maxLength={120}
              placeholder={t("create.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-description">{t("create.descriptionOptional")}</Label>
            <Textarea
              id="campaign-description"
              rows={5}
              maxLength={2000}
              placeholder={t("create.descriptionPlaceholder")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      ),
    },
    {
      id: "system",
      label: t("create.steps.system"),
      title: t("create.systemTitle"),
      lead: t("create.systemLead"),
      why: t("create.systemWhy"),
      value: needsLabel && systemLabel.trim() ? systemLabel.trim() : GAME_SYSTEM_LABELS[system],
      content: (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(Object.keys(GAME_SYSTEM_LABELS) as GameSystem[]).map((option) => (
              <OptionCard
                key={option}
                selected={system === option}
                title={GAME_SYSTEM_LABELS[option]}
                hint={t(option === "dnd5e" ? "create.dnd5eHint" : "create.freeSheetHint")}
                onSelect={() => {
                  setSystem(option);
                  // One choice: the game decides the sheets — the computed 5E one, or the free one.
                  setCharacterSystem(characterSystemFor(option));
                }}
              />
            ))}
          </div>
          {needsLabel && (
            <div className="grid gap-2">
              <Label htmlFor="campaign-system-label">{t("create.systemLabel")}</Label>
              <Input
                id="campaign-system-label"
                maxLength={80}
                placeholder={t("create.systemLabelPlaceholder")}
                value={systemLabel}
                onChange={(event) => setSystemLabel(event.target.value)}
              />
            </div>
          )}
        </div>
      ),
    },
    ...(offersPacks
      ? [
          {
            id: "packs",
            label: t("create.steps.packs"),
            title: t("create.packsTitle"),
            lead: t("create.packsLead"),
            why: t("create.packsWhy"),
            value:
              chosenPacks.length > 0
                ? chosenPacks.map((pack) => packName(pack)).join(", ")
                : t("create.noPack"),
            content: (
              <ul className="flex flex-col gap-2">
                {library.map((pack) => (
                  <li key={pack.id}>
                    <label className="hover:bg-accent flex cursor-pointer items-start gap-3 rounded-xl border p-3">
                      <Checkbox
                        className="mt-0.5"
                        checked={packIds.has(pack.id)}
                        onCheckedChange={(checked) =>
                          setPackIds((current) => {
                            const next = new Set(current);
                            if (checked === true) next.add(pack.id);
                            else next.delete(pack.id);
                            return next;
                          })
                        }
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          <PackageIcon className="text-muted-foreground size-4" />
                          {packName(pack)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {packSummary(pack.pack)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ),
          } satisfies FlowStep,
        ]
      : []),
    {
      id: "review",
      label: t("create.steps.review"),
      title: t("create.reviewTitle"),
      lead: t("create.reviewLead"),
      why: t("create.reviewWhy"),
      content: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border p-4 text-sm">
          <dt className="text-muted-foreground">{t("create.name")}</dt>
          <dd className="font-medium">{name.trim()}</dd>
          {description.trim() && (
            <>
              <dt className="text-muted-foreground">{t("create.description")}</dt>
              <dd className="whitespace-pre-line">{description.trim()}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("create.system")}</dt>
          <dd>
            {needsLabel && systemLabel.trim() ? systemLabel.trim() : GAME_SYSTEM_LABELS[system]}
          </dd>
          <dt className="text-muted-foreground">{t("create.characterSystem")}</dt>
          <dd>{getSystem(characterSystem).label}</dd>
          {file && (
            <>
              <dt className="text-muted-foreground">{t("create.imported")}</dt>
              <dd>{contentLine}</dd>
            </>
          )}
          {offersPacks && (
            <>
              <dt className="text-muted-foreground">{t("create.steps.packs")}</dt>
              <dd>
                {chosenPacks.length > 0
                  ? chosenPacks.map((pack) => packName(pack)).join(", ")
                  : t("create.noPack")}
              </dd>
            </>
          )}
        </dl>
      ),
      action: { label: t("create.submit"), run: create },
    },
    {
      id: "invite",
      label: t("create.steps.invite"),
      title: t("create.inviteTitle"),
      lead: t("create.inviteLead"),
      why: t("create.inviteWhy"),
      content:
        campaign && user ? (
          <InvitePlayers
            campaign={campaign}
            me={{ uid: user.uid, displayName: user.displayName, email: user.email }}
          />
        ) : null,
    },
  ];
  const inviteIndex = steps.length - 1;

  return (
    <PageContainer size="wide" className="p-0">
      <GuidedFlow
        heading={t("create.title")}
        eyebrow={t("create.eyebrow")}
        steps={steps}
        index={Math.min(index, steps.length - 1)}
        onIndexChange={setIndex}
        // Once created, the campaign is edited from its page, not from here.
        lockedBefore={campaign ? inviteIndex : 0}
        lastReachable={campaign ? inviteIndex : inviteIndex - 1}
        busy={busy}
        onCancel={campaign ? undefined : () => navigate("/campaigns")}
        finish={{
          label: t("create.openCampaign"),
          run: () => navigate(`/campaigns/${campaign!.id}`, { replace: true }),
        }}
      />
    </PageContainer>
  );
}
