import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { type Campaign, type CodexEntry } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { PageContainer } from "@/components/page-container";
import { CodexFilters } from "@/components/codex/codex-filters";
import { CodexFormDialog } from "@/components/codex/codex-form-dialog";
import { CODEX_KIND_ICONS } from "@/components/codex/codex-kinds";
import { ReputationBadge, ReputationSelect } from "@/components/codex/reputation";
import { CodexLinksProvider } from "@/hooks/codex-links";
import { useCodex } from "@/hooks/use-codex";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { listAdventures, listAdventuresForPlayer } from "@/lib/adventures";
import {
  addCodexEntry,
  deleteCodexEntry,
  emptyCodexInput,
  getCodexSecret,
  setCodexRevealed,
  updateCodexEntry,
  type CodexInput,
} from "@/lib/codex";
import { listPublishedRecaps, type RecapRef } from "@/lib/codex-appearances";
import { countCodexKinds, filterCodex, parseCodexFilter } from "@/lib/codex-filter";
import { mentions } from "@/lib/codex-mentions";
import { cn } from "@/lib/utils";
import { getCampaign, type WithId } from "@/lib/collections";

/** One entry, opened: what the players know, the GM's secret, where it appears. */
function EntryDialog({
  campaignId,
  entry,
  isGm,
  recaps,
  onClose,
  onEdit,
}: {
  campaignId: string;
  entry: WithId<CodexEntry> | null;
  isGm: boolean;
  recaps: RecapRef[] | null;
  onClose: () => void;
  onEdit: (entry: WithId<CodexEntry>, secret: string) => void;
}) {
  const { t } = useTranslation(["codex", "common"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSecret(null);
    if (!entry || !isGm) return;
    getCodexSecret(campaignId, entry.id)
      .then(setSecret)
      .catch(() => setSecret(""));
  }, [entry, isGm, campaignId]);

  const appearances = entry && recaps ? recaps.filter((r) => mentions(r.text, entry.name)) : [];
  const Icon = entry ? CODEX_KIND_ICONS[entry.kind] : null;

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {Icon && <Icon className="size-4" />} {entry.name}
              </DialogTitle>
              <DialogDescription>{t(`kinds.${entry.kind}`)}</DialogDescription>
            </DialogHeader>
            {entry.kind === "faction" && (isGm || entry.reputation !== undefined) && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">{t("reputation.label")}</span>
                {isGm ? (
                  <ReputationSelect
                    campaignId={campaignId}
                    entryId={entry.id}
                    value={entry.reputation}
                  />
                ) : (
                  <ReputationBadge value={entry.reputation} />
                )}
              </div>
            )}
            {entry.imageUrl && (
              <img
                src={entry.imageUrl}
                alt={entry.name}
                className="max-h-[50vh] max-w-full self-center rounded-md border"
              />
            )}
            {entry.summary.trim() ? (
              <Markdown>{entry.summary}</Markdown>
            ) : (
              <p className="text-muted-foreground text-sm italic">{t("entry.noSummary")}</p>
            )}
            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
              >
                <ExternalLinkIcon className="size-4" /> {t("entry.openDocument")}
              </a>
            )}
            {isGm && (
              <div className="rounded-md border border-dashed p-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium">
                  {t("entry.secret")}
                </p>
                {secret === null ? (
                  <p className="text-muted-foreground text-sm">{t("common:actions.loading")}</p>
                ) : secret.trim() ? (
                  <Markdown>{secret}</Markdown>
                ) : (
                  <p className="text-muted-foreground text-sm italic">{t("entry.noSecret")}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                {t("entry.appearances")}
              </p>
              {recaps === null ? (
                <p className="text-muted-foreground text-sm">{t("common:actions.loading")}</p>
              ) : appearances.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">{t("entry.noAppearance")}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {appearances.map((r) => (
                    <li key={r.sessionId}>
                      <Link
                        to={`/campaigns/${campaignId}/adventures/${r.adventureId}`}
                        className="text-primary hover:underline"
                      >
                        {r.title
                          ? t("entry.sessionTitled", {
                              number: r.number,
                              title: r.title,
                              adventure: r.adventureTitle,
                            })
                          : t("entry.session", { number: r.number, adventure: r.adventureTitle })}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {t("entry.mentionHint", { name: entry.name })}
              </p>
            </div>
            {isGm && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive mr-auto"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2Icon /> {t("common:actions.delete")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEdit(entry, secret ?? "")}
                  disabled={secret === null}
                >
                  <PencilIcon /> {t("common:actions.edit")}
                </Button>
              </div>
            )}
            <ConfirmDialog
              open={deleting}
              onOpenChange={setDeleting}
              title={t("entry.deleteTitle", { name: entry.name })}
              description={t("entry.deleteText")}
              onConfirm={async () => {
                try {
                  await deleteCodexEntry(campaignId, entry.id);
                  onClose();
                } catch (error) {
                  console.error(error);
                  toast.error(t("common:deleteFailed"));
                }
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * `/campaigns/:id/codex` — the world as the party knows it. The GM writes
 * every entry and decides what is revealed; players read what they learned.
 */
export function CodexPage() {
  const { t } = useTranslation(["codex", "common"]);
  const { id: campaignId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [campaign, setCampaign] = useState<WithId<Campaign> | null | "missing">(null);
  const [search, setSearch] = useState("");
  const [recaps, setRecaps] = useState<RecapRef[] | null>(null);
  const [form, setForm] = useState<{ id: string | null; initial: CodexInput } | null>(null);

  const isGm = campaign !== null && campaign !== "missing" && campaign.ownerId === user?.uid;
  const ready = campaign !== null && campaign !== "missing";
  const entries = useCodex(ready ? campaignId : undefined, isGm);

  useEffect(() => {
    if (!campaignId) return;
    getCampaign(campaignId)
      .then((c) => setCampaign(c ?? "missing"))
      .catch(() => setCampaign("missing"));
  }, [campaignId]);

  // Published recaps, scanned for `[[Nom]]` when an entry is opened.
  const openId = params.get("entry");
  useEffect(() => {
    if (!openId || recaps !== null || !ready || !campaignId || !user) return;
    const adventures = isGm
      ? listAdventures(campaignId)
      : listAdventuresForPlayer(campaignId, user.uid);
    adventures
      .then((list) => listPublishedRecaps(campaignId, list))
      .then(setRecaps)
      .catch(() => setRecaps([]));
  }, [openId, recaps, ready, campaignId, user, isGm]);

  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    {
      label: campaign && campaign !== "missing" ? campaign.name : undefined,
      to: `/campaigns/${campaignId}`,
    },
    { label: t("title") },
  ]);

  // Kind and visibility live in the URL: a filtered view can be shared or kept.
  const filter = parseCodexFilter(params);
  // A player only reads revealed entries: the visibility filter is the GM's.
  const visibility = isGm ? filter.visibility : "all";
  const shown = useMemo(
    () => filterCodex(entries, { search, kind: filter.kind, visibility }),
    [entries, search, filter.kind, visibility],
  );
  const counts = useMemo(
    () => countCodexKinds(entries, { search, visibility }),
    [entries, search, visibility],
  );

  function setFilterParam(name: "type" | "shown", value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === "all") next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );
  }

  if (campaign === "missing") {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("missing")}</p>
      </PageContainer>
    );
  }
  if (!campaign || !campaignId || !user) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  const opened = entries.find((e) => e.id === openId) ?? null;
  const open = (entryId: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (entryId) next.set("entry", entryId);
        else next.delete("entry");
        return next;
      },
      { replace: true },
    );

  async function toggleRevealed(entry: WithId<CodexEntry>) {
    try {
      await setCodexRevealed(campaignId!, entry.id, !entry.revealed);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    }
  }

  return (
    <CodexLinksProvider campaignId={campaignId} entries={entries}>
      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{isGm ? t("introGm") : t("intro")}</p>
          </div>
          {isGm && (
            <Button type="button" onClick={() => setForm({ id: null, initial: emptyCodexInput() })}>
              <PlusIcon /> {t("new")}
            </Button>
          )}
        </div>

        <CodexFilters
          search={search}
          onSearchChange={setSearch}
          kind={filter.kind}
          onKindChange={(kind) => setFilterParam("type", kind)}
          visibility={filter.visibility}
          onVisibilityChange={(shown) => setFilterParam("shown", shown)}
          counts={counts}
          isGm={isGm}
        />

        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {entries.length === 0 ? (isGm ? t("emptyGm") : t("empty")) : t("noMatch")}
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((entry) => {
            const Icon = CODEX_KIND_ICONS[entry.kind];
            return (
              <li
                key={entry.id}
                className={cn(
                  "hover:bg-muted/40 relative flex gap-3 rounded-lg border p-3 transition-colors",
                  // The GM sees at a glance what the players do not.
                  isGm && !entry.revealed && "border-dashed",
                )}
              >
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded object-cover"
                    onError={(event) => (event.currentTarget.style.display = "none")}
                  />
                ) : (
                  <div className="bg-muted flex size-14 shrink-0 items-center justify-center rounded">
                    <Icon className="text-muted-foreground size-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    // Stretched over the card: the whole card opens the entry.
                    className="block w-full truncate text-left font-medium after:absolute after:inset-0 after:rounded-lg"
                    onClick={() => open(entry.id)}
                  >
                    {entry.name}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="gap-1 font-normal">
                      <Icon className="size-3" /> {t(`kinds.${entry.kind}`)}
                    </Badge>
                    {entry.kind === "faction" && <ReputationBadge value={entry.reputation} />}
                    {isGm && !entry.revealed && <Badge variant="outline">{t("hidden")}</Badge>}
                  </div>
                </div>
                {isGm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative z-10 size-8 shrink-0"
                    aria-label={
                      entry.revealed
                        ? t("hideWhat", { name: entry.name })
                        : t("revealWhat", { name: entry.name })
                    }
                    onClick={() => toggleRevealed(entry)}
                  >
                    {entry.revealed ? (
                      <EyeIcon className="size-4" />
                    ) : (
                      <EyeOffIcon className="size-4" />
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground text-xs">
          <Link to={`/campaigns/${campaignId}`} className="hover:underline">
            {t("back", { campaign: campaign.name })}
          </Link>
        </p>

        <EntryDialog
          campaignId={campaignId}
          entry={opened}
          isGm={isGm}
          recaps={recaps}
          onClose={() => open(null)}
          onEdit={(entry, secret) =>
            setForm({
              id: entry.id,
              initial: {
                kind: entry.kind,
                name: entry.name,
                summary: entry.summary,
                imageUrl: entry.imageUrl ?? "",
                url: entry.url ?? "",
                secret,
              },
            })
          }
        />
        {isGm && (
          <CodexFormDialog
            open={form !== null}
            onOpenChange={(o) => !o && setForm(null)}
            editing={Boolean(form?.id)}
            initial={form?.initial ?? emptyCodexInput()}
            onSave={async (values) => {
              if (form?.id) await updateCodexEntry(campaignId, form.id, values);
              else open(await addCodexEntry(campaignId, values));
            }}
          />
        )}
      </PageContainer>
    </CodexLinksProvider>
  );
}
