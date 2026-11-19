import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DownloadIcon, PrinterIcon } from "lucide-react";
import type { Adventure, Campaign } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { PageContainer } from "@/components/page-container";
import { ChronicleTimeline } from "@/components/adventure/chronicle-timeline";
import { CodexLinksProvider } from "@/hooks/codex-links";
import { useCodex } from "@/hooks/use-codex";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import {
  getAdventure,
  listAdventures,
  listAdventuresForPlayer,
  listParticipants,
} from "@/lib/adventures";
import { loadChronicle } from "@/lib/chronicle-book";
import {
  campaignChronicleMarkdown,
  chronicleMarkdown,
  type ChronicleChapter,
  type ChronicleLabels,
  type ChroniclePart,
} from "@/lib/chronicle-markdown";
import { getCampaign, type WithId } from "@/lib/collections";
import { sessionSpanLabel } from "@/lib/game-time";
import { listQuests } from "@/lib/quests";

/** « 14 oct. 2026, 20:30 → 23:45 (3 h 15) ». */
const formatDate = (start: number, end?: number) => sessionSpanLabel(start, end);

/** One adventure of the book, with its sessions. */
interface BookPart extends ChroniclePart {
  adventureId: string;
}

/**
 * `/campaigns/:id/adventures/:adventureId/chronique` — the adventure read as a
 * book, session after session — and `/campaigns/:id/chronique`, the whole
 * campaign, adventure after adventure. Both open on a timeline of what
 * happened, then the recaps: to read in one go, print (or save as PDF) or
 * download as Markdown.
 */
export function ChronicleBookPage() {
  const { t } = useTranslation(["adventures", "codex", "common", "session"]);
  const { id: campaignId, adventureId } = useParams<{ id: string; adventureId?: string }>();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<WithId<Campaign> | null>(null);
  const [adventure, setAdventure] = useState<WithId<Adventure> | null>(null);
  const [parts, setParts] = useState<BookPart[] | null>(null);
  const [failed, setFailed] = useState(false);
  const isGm = Boolean(campaign && user && campaign.ownerId === user.uid);
  const codex = useCodex(campaign ? campaignId : undefined, isGm);
  const wholeCampaign = !adventureId;

  useEffect(() => {
    if (!campaignId || !user) return;
    let cancelled = false;
    (async () => {
      const c = await getCampaign(campaignId);
      const gm = c?.ownerId === user.uid;
      const quests = await listQuests(campaignId, gm).catch(() => []);
      const adventures = adventureId
        ? [await getAdventure(campaignId, adventureId)].filter((a): a is WithId<Adventure> =>
            Boolean(a),
          )
        : gm
          ? await listAdventures(campaignId)
          : await listAdventuresForPlayer(campaignId, user.uid);
      const book = await Promise.all(
        adventures.map(async (a) => ({
          adventureId: a.id,
          adventure: a.title,
          summary: a.summary,
          chapters: await loadChronicle(
            campaignId,
            a.id,
            await listParticipants(campaignId, a.id),
            quests,
          ),
        })),
      );
      if (cancelled) return;
      setCampaign(c);
      setAdventure(adventureId ? (adventures[0] ?? null) : null);
      // The campaign book keeps only the adventures with a story to tell.
      setParts(adventureId ? book : book.filter((part) => part.chapters.length > 0));
    })().catch((error) => {
      console.error(error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, adventureId, user]);

  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: campaign?.name, to: `/campaigns/${campaignId}` },
    ...(wholeCampaign
      ? []
      : [{ label: adventure?.title, to: `/campaigns/${campaignId}/adventures/${adventureId}` }]),
    { label: wholeCampaign ? t("book.campaignTitle") : t("chronicle.title") },
  ]);

  if (failed) {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("book.loadFailed")}</p>
      </PageContainer>
    );
  }
  if (!parts || !campaign || !campaignId || (!wholeCampaign && !adventure)) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  const heading = (number: number, title?: string) =>
    title ? t("chronicle.headingTitled", { number, title }) : t("chronicle.heading", { number });
  const backTo = wholeCampaign
    ? `/campaigns/${campaignId}`
    : `/campaigns/${campaignId}/adventures/${adventureId}`;
  const empty = parts.every((part) => part.chapters.length === 0);

  function download() {
    const labels: ChronicleLabels = {
      session: heading,
      playedOn: (date) => t("book.playedOn", { date }),
      present: t("recap.prefillAttendees"),
      places: t("recap.prefillPlaces"),
      events: t("chronicle.events"),
      documents: `${t("codex:handout.chronicle")} :`,
      loot: t("recap.prefillLoot"),
      defeated: t("recap.prefillDefeated"),
      quests: t("recap.prefillQuests"),
      quotes: t("chronicle.quotes"),
      journalOf: (name, title) =>
        title ? t("journal.byTitled", { name, title }) : t("journal.by", { name }),
      day: (day) => t("session:clock.day", { day }),
    };
    const text = wholeCampaign
      ? campaignChronicleMarkdown(
          { campaign: campaign!.name, summary: campaign!.description },
          parts!,
          labels,
          formatDate,
        )
      : chronicleMarkdown(
          { adventure: adventure!.title, campaign: campaign!.name, summary: adventure!.summary },
          parts![0]?.chapters ?? [],
          labels,
          formatDate,
        );
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const name = wholeCampaign ? campaign!.name : adventure!.title;
    link.download = `${name.replace(/[\\/:*?"<>|]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CodexLinksProvider campaignId={campaignId} entries={codex}>
      <PageContainer size="narrow" className="flex flex-col gap-8 print:max-w-none">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button asChild variant="ghost" size="sm" className="mr-auto">
            <Link to={backTo}>{wholeCampaign ? t("book.backToCampaign") : t("book.back")}</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon /> {t("book.print")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <DownloadIcon /> {t("book.download")}
          </Button>
        </div>

        <header className="text-center">
          {wholeCampaign ? (
            <>
              <p className="text-muted-foreground text-sm">{t("book.campaignTitle")}</p>
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-muted-foreground mx-auto mt-2 max-w-prose text-sm">
                  {campaign.description}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{campaign.name}</p>
              <h1 className="text-3xl font-bold tracking-tight">{adventure!.title}</h1>
              {adventure!.summary && (
                <p className="text-muted-foreground mx-auto mt-2 max-w-prose text-sm">
                  {adventure!.summary}
                </p>
              )}
            </>
          )}
        </header>

        {empty ? (
          <p className="text-muted-foreground text-center text-sm">{t("chronicle.empty")}</p>
        ) : (
          <ChronicleTimeline parts={parts} showAdventures={wholeCampaign} heading={heading} />
        )}

        {parts.map((part) => (
          <section key={part.adventureId} className="flex flex-col gap-8">
            {wholeCampaign && (
              <header className="border-b pb-2">
                <h2 className="text-2xl font-bold tracking-tight">{part.adventure}</h2>
                {part.summary && (
                  <p className="text-muted-foreground mt-1 text-sm">{part.summary}</p>
                )}
              </header>
            )}
            {part.chapters.map((c) => (
              <ChapterArticle
                key={c.sessionId}
                chapter={c}
                heading={heading}
                nested={wholeCampaign}
              />
            ))}
          </section>
        ))}
      </PageContainer>
    </CodexLinksProvider>
  );
}

function ChapterArticle({
  chapter: c,
  heading,
  nested,
}: {
  chapter: ChronicleChapter;
  heading: (number: number, title?: string) => string;
  /** In the campaign book a session sits one level down, under its adventure. */
  nested: boolean;
}) {
  const { t } = useTranslation(["adventures", "codex", "session"]);
  const Title = nested ? "h3" : "h2";
  const Sub = nested ? "h4" : "h3";
  return (
    <article className="flex flex-col gap-3 break-inside-avoid-page">
      <header>
        <Title className="text-xl font-semibold">{heading(c.number, c.title)}</Title>
        <p className="text-muted-foreground text-xs">
          {[
            t("book.playedOn", { date: formatDate(c.playedAt, c.endedAt) }),
            c.gameDay && t("session:clock.day", { day: c.gameDay }),
            c.gameDate,
          ]
            .filter(Boolean)
            .join(" · ")}
          {c.attendees.length > 0 && ` · ${c.attendees.join(", ")}`}
        </p>
      </header>
      <Markdown className="text-base leading-7">{c.recap}</Markdown>
      {c.events.length > 0 && (
        <section>
          <Sub className="text-sm font-semibold">{t("chronicle.events")}</Sub>
          <ul className="list-disc pl-5 text-sm">
            {c.events.map((e) => (
              <li key={e.title}>
                <span className="font-medium">{e.title}</span>
                {e.description && <> — {e.description}</>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(c.documents.length > 0 || c.loot.length > 0) && (
        <p className="text-sm">
          {c.documents.length > 0 && (
            <>
              <span className="font-semibold">{t("codex:handout.chronicle")} : </span>
              {c.documents.join(", ")}
              {c.loot.length > 0 && " · "}
            </>
          )}
          {c.loot.length > 0 && (
            <>
              <span className="font-semibold">{t("chronicle.loot")} : </span>
              {c.loot.join(", ")}
            </>
          )}
        </p>
      )}
      {c.quotes.map((q) => (
        <blockquote key={q.text} className="border-l-2 pl-3 text-sm italic">
          « {q.text} »{q.speaker && <span className="not-italic"> — {q.speaker}</span>}
        </blockquote>
      ))}
      {c.journals.map((j, index) => (
        <section key={index} className="bg-muted/30 rounded-md p-3 print:bg-transparent">
          <Sub className="text-sm font-semibold">
            {j.title
              ? t("journal.byTitled", { name: j.characterName, title: j.title })
              : t("journal.by", { name: j.characterName })}
          </Sub>
          <Markdown className="text-muted-foreground">{j.body}</Markdown>
        </section>
      ))}
    </article>
  );
}
