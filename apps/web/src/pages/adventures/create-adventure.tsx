import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPinIcon, SparklesIcon, SwordsIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  parseAdventureFile,
  type AdventureFile,
  type FileAdventure,
} from "@adventure-keeper/schemas";
import { ABILITIES } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { ImportGuide } from "@/components/campaign/import-guide";
import { PageContainer } from "@/components/page-container";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnemyEditor, type EnemyEntry } from "@/components/adventure/enemy-editor";
import { LocationEditor, type LocationEntry } from "@/components/adventure/location-editor";
import { NpcEditor, type NpcEntry } from "@/components/adventure/npc-editor";
import { draftKey } from "@/components/adventure/drafts";
import { draftToLoot, lootToDraft, normalizePlannedLoot } from "@/lib/planned-loot";
import { enemyFormToInput } from "@/components/adventure/enemy-form";
import { GuidedFlow, type FlowStep } from "@/components/wizard/guided-flow";
import { ImportStart } from "@/components/wizard/import-start";
import { useFullWidthPage } from "@/hooks/use-full-width-page";
import { addEnemy, addEvent, addLocation, addNpc, createAdventure } from "@/lib/adventures";
import { fileCounts } from "@/lib/campaign-file";
import { listCampaignPacks } from "@/systems/dnd2024/lib/packs";
import { useAuth } from "@/hooks/use-auth";
import { useCampaignPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { getCampaign } from "@/lib/collections";

/** What a file brings that the editors do not show — kept as is. */
interface FileExtras {
  color?: string;
  description?: string;
  imageUrl?: string;
}

/** An adventure file's content as the creation's editable entries. */
function entriesOf(adventure: FileAdventure) {
  const locations: LocationEntry[] = adventure.locations.map((l) => ({
    key: draftKey(),
    name: l.name,
    description: l.description ?? "",
    imageUrl: l.imageUrl ?? "",
    hidden: l.hidden ?? false,
    loot: lootToDraft(normalizePlannedLoot(l.loot)),
  }));
  const keyOf = (name?: string) => locations.find((l) => l.name === name)?.key ?? "";
  const enemies: (EnemyEntry & FileExtras)[] = adventure.enemies.map((e) => ({
    key: draftKey(),
    name: e.name,
    armorClass: String(e.armorClass),
    maxHitPoints: String(e.maxHitPoints),
    speed: String(e.speed ?? 9),
    locationId: keyOf(e.location),
    notes: e.notes ?? "",
    attacks: e.attacks ?? [],
    sourceMonsterId: e.sourceMonsterId,
    challengeRating: e.challengeRating,
    size: e.size,
    abilityScores: Object.fromEntries(
      ABILITIES.map((a) => [a, e.abilityScores?.[a] != null ? String(e.abilityScores[a]) : ""]),
    ),
    color: e.color,
    description: e.description,
    imageUrl: e.imageUrl,
    loot: lootToDraft(normalizePlannedLoot(e.loot)),
  }));
  const npcs: (NpcEntry & FileExtras)[] = adventure.npcs.map((n) => ({
    key: draftKey(),
    name: n.name,
    personality: n.personality ?? "",
    lore: n.lore ?? "",
    locationId: keyOf(n.location),
    enemyId: "",
    color: n.color,
  }));
  return { locations, enemies, npcs };
}

export function CreateAdventurePage() {
  const { t } = useTranslation(["adventures", "common"]);
  const { id: campaignId } = useParams<{ id: string }>();
  // The campaign's packs: their monsters are offered for enemies.
  useCampaignPacks(campaignId);
  const [campaignName, setCampaignName] = useState<string>();
  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    getCampaign(campaignId)
      .then((campaign) => active && setCampaignName(campaign?.name ?? t("create.campaignFallback")))
      .catch(() => active && setCampaignName(t("create.campaignFallback")));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` only names a missing campaign
  }, [campaignId]);
  useFullWidthPage(true);
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: campaignName, to: `/campaigns/${campaignId}` },
    { label: t("create.crumb") },
  ]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [enemies, setEnemies] = useState<(EnemyEntry & FileExtras)[]>([]);
  const [npcs, setNpcs] = useState<(NpcEntry & FileExtras)[]>([]);
  /** Highlights only come from a file: the adventure page edits them afterwards. */
  const [events, setEvents] = useState<FileAdventure["events"]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{
    fileName: string;
    file?: AdventureFile;
    errors: string[];
  } | null>(null);
  const file = importing ? imported?.file : undefined;
  const [campaignPackIds, setCampaignPackIds] = useState<string[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    listCampaignPacks(campaignId)
      .then((packs) => setCampaignPackIds(packs.map((p) => p.packId)))
      .catch(() => setCampaignPackIds([]));
  }, [campaignId]);
  const missingPacks = (file?.packs ?? []).filter((ref) => !campaignPackIds.includes(ref.id));

  /** Read an adventure file: it fills every screen that follows. */
  function readFile(fileName: string, text: string) {
    const result = parseAdventureFile(text);
    if (!result.ok) {
      setImported({ fileName, errors: result.errors });
      return;
    }
    const { adventure } = result.file;
    const entries = entriesOf(adventure);
    setImported({ fileName, file: result.file, errors: [] });
    setTitle(adventure.title);
    setSummary(adventure.summary ?? "");
    setLocations(entries.locations);
    setEnemies(entries.enemies);
    setNpcs(entries.npcs);
    setEvents(adventure.events);
  }
  const [submitting, setSubmitting] = useState(false);
  const [index, setIndex] = useState(0);

  const locationOptions = useMemo(
    () => locations.map((loc) => ({ id: loc.key, name: loc.name })),
    [locations],
  );

  /** Drop links to a location that no longer exists. */
  function forgetLocation(key: string) {
    setEnemies((cur) => cur.map((e) => (e.locationId === key ? { ...e, locationId: "" } : e)));
    setNpcs((cur) => cur.map((n) => (n.locationId === key ? { ...n, locationId: "" } : n)));
  }

  async function submit() {
    if (!campaignId || !user) return;
    if (!title.trim()) {
      toast.error(t("create.titleRequired"));
      return;
    }

    const keptLocations = locations.filter((loc) => loc.name.trim());
    const keptEnemies = enemies.filter((en) => en.name.trim());
    const keptNpcs = npcs.filter((npc) => npc.name.trim());

    setSubmitting(true);
    let adventureId: string;
    try {
      adventureId = await createAdventure(
        campaignId,
        {
          title: title.trim(),
          summary: summary.trim() || undefined,
        },
        user.uid,
      );
    } catch (error) {
      console.error(error);
      toast.error(t("create.failed"));
      setSubmitting(false);
      return;
    }

    // Locations first — their ids are needed to link enemies / NPCs.
    const locationIdByKey = new Map<string, string>();
    let failures = 0;
    for (const [index, loc] of keptLocations.entries()) {
      try {
        const locId = await addLocation(
          campaignId,
          adventureId,
          {
            name: loc.name.trim(),
            description: loc.description,
            imageUrl: loc.imageUrl,
            hidden: loc.hidden,
            scale: loc.scale,
            loot: draftToLoot(loc.loot),
          },
          index,
        );
        locationIdByKey.set(loc.key, locId);
      } catch (error) {
        console.error(error);
        failures += 1;
      }
    }

    const resolveLoc = (key: string) => (key ? locationIdByKey.get(key) : undefined);

    const rest = await Promise.allSettled([
      ...keptEnemies.map((en) =>
        addEnemy(campaignId, adventureId, {
          ...enemyFormToInput(en),
          locationId: resolveLoc(en.locationId),
          color: en.color,
          description: en.description,
          imageUrl: en.imageUrl,
        }),
      ),
      ...keptNpcs.map((npc, index) =>
        addNpc(
          campaignId,
          adventureId,
          {
            name: npc.name.trim(),
            personality: npc.personality,
            lore: npc.lore,
            locationId: resolveLoc(npc.locationId),
            color: npc.color,
          },
          index,
        ),
      ),
      ...events.map((event, index) =>
        addEvent(
          campaignId,
          adventureId,
          {
            title: event.title,
            description: event.description ?? "",
            trigger: event.trigger ?? "",
            dueDay: event.dueDay,
            dueTime: event.dueTime,
          },
          index,
        ),
      ),
    ]);
    failures += rest.filter((r) => r.status === "rejected").length;

    if (failures > 0) {
      toast.warning(t("create.partial", { count: failures }));
    } else {
      toast.success(t("create.created"));
    }
    navigate(`/campaigns/${campaignId}/adventures/${adventureId}`, { replace: true });
  }

  const named = (list: { name: string }[]) => list.map((x) => x.name.trim()).filter(Boolean);

  const counts = file ? fileCounts([file.adventure]) : null;

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
            file &&
            counts && (
              <p className="text-sm">
                <span className="font-medium">{file.adventure.title}</span> —{" "}
                {t("create.importedContent", { ...counts })}
              </p>
            )
          }
          guide={<ImportGuide kind="adventure" />}
        />
      ),
    },
    {
      id: "pitch",
      label: t("create.steps.pitch"),
      title: t("create.pitchTitle"),
      lead: t("create.pitchLead"),
      why: t("create.pitchWhy"),
      value: title.trim(),
      issues: title.trim() ? [] : [t("create.titleRequired")],
      content: (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t("create.titleLabel")}</Label>
            <Input
              id="title"
              autoFocus
              placeholder={t("create.titlePlaceholder")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary">{t("create.summaryOptional")}</Label>
            <Textarea
              id="summary"
              rows={5}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
        </div>
      ),
    },
    {
      id: "locations",
      label: t("create.locations"),
      title: t("create.locationsTitle"),
      lead: t("create.locationsIntro"),
      why: t("create.locationsWhy"),
      value: named(locations).join(" · ") || t("create.noLocation"),
      content: (
        <LocationEditor
          items={locations}
          onAdd={(values) => setLocations((cur) => [...cur, { ...values, key: draftKey() }])}
          onUpdate={(key, values) =>
            setLocations((cur) => cur.map((l) => (l.key === key ? { ...l, ...values } : l)))
          }
          onRemove={(key) => {
            setLocations((cur) => cur.filter((l) => l.key !== key));
            forgetLocation(key);
          }}
        />
      ),
    },
    {
      id: "enemies",
      label: t("create.enemies"),
      title: t("create.enemiesTitle"),
      lead: t("create.enemiesIntro"),
      why: t("create.enemiesWhy"),
      value: named(enemies).join(" · ") || t("create.noEnemy"),
      content: (
        <EnemyEditor
          items={enemies}
          locationOptions={locationOptions}
          onAdd={(values) => setEnemies((cur) => [...cur, { ...values, key: draftKey() }])}
          onUpdate={(key, values) =>
            setEnemies((cur) => cur.map((e) => (e.key === key ? { ...e, ...values } : e)))
          }
          onRemove={(key) => setEnemies((cur) => cur.filter((e) => e.key !== key))}
        />
      ),
    },
    {
      id: "npcs",
      label: t("create.npcs"),
      title: t("create.npcsTitle"),
      lead: t("create.npcsIntro"),
      why: t("create.npcsWhy"),
      value: named(npcs).join(" · ") || t("create.noNpc"),
      content: (
        <NpcEditor
          items={npcs}
          locationOptions={locationOptions}
          onAdd={(values) => setNpcs((cur) => [...cur, { ...values, key: draftKey() }])}
          onUpdate={(key, values) =>
            setNpcs((cur) => cur.map((n) => (n.key === key ? { ...n, ...values } : n)))
          }
          onRemove={(key) => setNpcs((cur) => cur.filter((n) => n.key !== key))}
        />
      ),
    },
    {
      id: "review",
      label: t("create.steps.review"),
      title: t("create.reviewTitle"),
      lead: t("create.reviewLead"),
      why: t("create.reviewWhy"),
      content: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border p-4 text-sm">
          <dt className="text-muted-foreground">{t("create.titleLabel")}</dt>
          <dd className="font-medium">{title.trim()}</dd>
          {summary.trim() && (
            <>
              <dt className="text-muted-foreground">{t("create.summary")}</dt>
              <dd className="whitespace-pre-line">{summary.trim()}</dd>
            </>
          )}
          {(
            [
              [MapPinIcon, t("create.locations"), named(locations), t("create.noLocation")],
              [SwordsIcon, t("create.enemies"), named(enemies), t("create.noEnemy")],
              [UsersIcon, t("create.npcs"), named(npcs), t("create.noNpc")],
            ] as const
          ).map(([Icon, label, names, none]) => (
            <Fragment key={label}>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Icon className="size-3.5" /> {label}
              </dt>
              <dd>{names.length > 0 ? names.join(" · ") : none}</dd>
            </Fragment>
          ))}
          {events.length > 0 && (
            <>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <SparklesIcon className="size-3.5" /> {t("events.title")}
              </dt>
              <dd>{events.map((e) => e.title).join(" · ")}</dd>
            </>
          )}
        </dl>
      ),
    },
  ];

  return (
    <PageContainer size="wide" className="p-0">
      <GuidedFlow
        heading={t("create.title")}
        eyebrow={t("create.eyebrow")}
        steps={steps}
        index={index}
        onIndexChange={setIndex}
        busy={submitting}
        onCancel={() => navigate(`/campaigns/${campaignId}`)}
        finish={{ label: t("create.submit"), run: submit }}
      />
    </PageContainer>
  );
}
