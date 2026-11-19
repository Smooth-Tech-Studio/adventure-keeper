import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  FlagIcon,
  GemIcon,
  MapIcon,
  PencilIcon,
  SparklesIcon,
  SwordsIcon,
} from "lucide-react";
import {
  sessionNumbers,
  type AdventureParticipant,
  type LiveSession,
  type ReadyCharacter,
  type Quest,
  type SessionMapReveal,
  type SessionQuote,
  type ShownDocument,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CropIcon } from "@/components/character/crop-icon";
import { MapFog } from "@/components/session/map-fog";
import { RecapEditorDialog } from "@/components/adventure/recap-editor-dialog";
import { SessionJournal } from "@/components/adventure/session-journal";
import { ShownDocumentDialog } from "@/components/adventure/shown-document-dialog";
import { unpackMask } from "@/lib/fog-grid";
import { listMapReveals } from "@/lib/sessions";
import { listQuotes } from "@/lib/session-memory";
import { useQuests } from "@/hooks/use-quests";
import { useCodex } from "@/hooks/use-codex";
import { lootLabel, recapSkeleton, sessionFacts } from "@/lib/recap";
import { toMillis } from "@/lib/firestore";
import { sessionSpanLabel } from "@/lib/game-time";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";
import { getCompanionSheet } from "@/lib/characters";
import { initials } from "@/lib/format";

type ChronicleTab = "story" | "notebook" | "journals";

interface Props {
  campaignId: string;
  campaignName: string;
  adventureId: string;
  adventureTitle: string;
  isGm: boolean;
  userId: string;
  /** Every ended session of the adventure. */
  sessions: WithId<LiveSession>[];
  participants: WithId<AdventureParticipant>[];
  onChange: () => void | Promise<void>;
}

/**
 * A visited location's map as the party left it: the image under its fog, so
 * nothing the party never uncovered shows. Sized by the image itself — the
 * caller crops it.
 */
function RevealedMapImage({
  reveal,
  className,
}: {
  reveal: WithId<SessionMapReveal>;
  className?: string;
}) {
  const cols = reveal.cols ?? 0;
  const rows = reveal.rows ?? 0;
  const mask = reveal.mask && cols && rows ? unpackMask(reveal.mask, cols, rows) : null;
  return (
    <div className={cn("relative", className)}>
      <img src={reveal.imageUrl} alt="" className="block w-full" />
      {reveal.hidden && cols > 0 && rows > 0 && (
        <MapFog mask={mask} cols={cols} rows={rows} role="review" />
      )}
    </div>
  );
}

/** Read-only viewer for one visited location's revealed map. */
function RevealedMapView({ reveal }: { reveal: WithId<SessionMapReveal> }) {
  const { t } = useTranslation("adventures", { keyPrefix: "past" });
  if (!reveal.imageUrl) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex aspect-video items-center justify-center rounded-md border text-sm">
        {t("noMap")}
      </div>
    );
  }
  const cols = reveal.cols ?? 0;
  const rows = reveal.rows ?? 0;
  const mask = reveal.mask && cols && rows ? unpackMask(reveal.mask, cols, rows) : null;
  return (
    <div className="relative inline-block max-h-[60vh] overflow-hidden rounded-md border">
      <img src={reveal.imageUrl} alt={reveal.name} className="block max-h-[60vh] max-w-full" />
      {reveal.hidden && cols > 0 && rows > 0 && (
        <MapFog mask={mask} cols={cols} rows={rows} role="review" />
      )}
    </div>
  );
}

/** A small framed preview with a caption, opening the thing it shows. */
function Thumb({
  caption,
  icon,
  onClick,
  children,
}: {
  caption: string;
  icon: ReactNode;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:border-ring focus-visible:ring-ring/50 w-28 overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none sm:w-32"
    >
      <span className="bg-muted text-muted-foreground relative block h-[74px] overflow-hidden">
        {children ?? <span className="flex h-full items-center justify-center">{icon}</span>}
      </span>
      <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs leading-tight font-semibold">
        <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
        <span className="min-w-0 break-words">{caption}</span>
      </span>
    </button>
  );
}

/** One block of the notebook tab: a small heading and what the session held. */
function NotebookTile({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0">
      <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold [&>svg]:size-3.5">
        {icon} {label}
      </h4>
      <div className="text-sm">{children}</div>
    </section>
  );
}

/** One chapter of the chronicle: a played session and its recap. */
function ChronicleEntry({
  campaignId,
  campaignName,
  adventureId,
  adventureTitle,
  isGm,
  userId,
  session,
  number,
  participants,
  quests,
  characters,
  tab,
  onTabChange,
  onChange,
}: Omit<Props, "sessions"> & {
  session: WithId<LiveSession>;
  number: number;
  quests: WithId<Quest>[];
  /** The participants' sheets, by character id — for the attendees' portraits. */
  characters: Readonly<Record<string, WithId<ReadyCharacter>>>;
  tab: ChronicleTab;
  onTabChange: (tab: ChronicleTab) => void;
}) {
  const { t } = useTranslation(["adventures", "common", "codex", "session"]);
  const codex = useCodex(campaignId, isGm);
  const [reveals, setReveals] = useState<WithId<SessionMapReveal>[]>([]);
  const [viewing, setViewing] = useState<WithId<SessionMapReveal> | null>(null);
  const [opened, setOpened] = useState<ShownDocument | null>(null);
  const [editing, setEditing] = useState(false);
  const [quotes, setQuotes] = useState<WithId<SessionQuote>[]>([]);
  const [journalCount, setJournalCount] = useState(0);

  useEffect(() => {
    listQuotes(campaignId, adventureId, session.id)
      .then(setQuotes)
      .catch(() => setQuotes([]));
  }, [campaignId, adventureId, session.id]);

  const visitedCount = session.visitedLocationIds?.length ?? 0;
  useEffect(() => {
    if (visitedCount === 0) return;
    listMapReveals(campaignId, adventureId, session.id)
      .then(setReveals)
      .catch(() => setReveals([]));
  }, [visitedCount, campaignId, adventureId, session.id]);

  const facts = sessionFacts(session, participants, reveals, quests);
  const visited = (session.visitedLocationIds ?? [])
    .map((id) => reveals.find((r) => r.locationId === id))
    .filter((r): r is WithId<SessionMapReveal> => Boolean(r));
  // The last place of the session lends its map to the banner.
  const bannerMap = [...visited].reverse().find((r) => r.imageUrl);
  const events = session.revealedEvents ?? [];
  const loot = session.loot ?? [];
  const documents = session.shownDocuments ?? [];

  // How many blocks the notebook holds — the count on its tab.
  const notebookCount = [
    events.length,
    facts.quests.length,
    facts.defeated.length,
    loot.length,
    documents.length,
    visited.length,
  ].filter((count) => count > 0).length;
  const attendeeUids = new Set(session.attendeeUids ?? []);
  const attendees = participants.filter((p) => attendeeUids.has(p.playerId));

  const gameDay = [
    session.gameDay && t("session:clock.day", { day: session.gameDay }),
    session.gameDate,
  ]
    .filter(Boolean)
    .join(" · ");
  // Titled sessions carry their number in the eyebrow; untitled ones in the title.
  const eyebrow = session.title
    ? [t("chronicle.heading", { number }), gameDay].filter(Boolean).join(" · ")
    : gameDay;
  const heading = session.title ?? t("chronicle.heading", { number });
  const onImage = Boolean(bannerMap);

  return (
    <article className="flex flex-col gap-4">
      <header
        className={cn(
          "bg-muted/40 relative min-h-36 overflow-hidden rounded-xl border sm:min-h-48",
          onImage && "text-white",
        )}
      >
        {bannerMap && (
          <>
            <RevealedMapImage
              reveal={bannerMap}
              className="absolute top-1/2 left-0 w-full -translate-y-1/2"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/90" />
          </>
        )}
        <div className="relative flex min-h-36 flex-col justify-end gap-1 px-4 pt-14 pb-3 sm:min-h-48 sm:px-5 sm:pt-20 sm:pb-4">
          {eyebrow && (
            <p
              className={cn(
                "text-xs font-semibold tracking-wider uppercase",
                !onImage && "text-muted-foreground",
              )}
            >
              {eyebrow}
            </p>
          )}
          <h3 className="text-2xl leading-tight font-semibold sm:text-3xl">{heading}</h3>
          {/* A div, not a p: the attendees' portraits are divs. */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
              !onImage && "text-muted-foreground",
              onImage && "text-white/80",
            )}
          >
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" />
              {sessionSpanLabel(toMillis(session.startedAt), toMillis(session.endedAt))}
            </span>
            {attendees.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="flex -space-x-1" aria-hidden>
                  {attendees.map((attendee) => {
                    const sheet = characters[attendee.characterId];
                    return (
                      <CropIcon
                        key={attendee.id}
                        imageUrl={sheet?.imageUrl}
                        crop={sheet?.imageCrop}
                        color={sheet?.color}
                        fallback={initials(attendee.characterName)}
                        size={24}
                        className="bg-background rounded-full text-[10px]"
                      />
                    );
                  })}
                </span>
                {attendees.map((attendee) => attendee.characterName).join(", ")}
              </span>
            )}
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as ChronicleTab)}>
        <TabsList variant="line">
          <TabsTrigger value="story">{t("chronicle.tabStory")}</TabsTrigger>
          <TabsTrigger value="notebook">
            {t("chronicle.tabNotebook")} · {notebookCount}
          </TabsTrigger>
          {session.recap && (
            <TabsTrigger value="journals">
              {t("chronicle.tabJournals")} · {journalCount}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="story"
          className="flex flex-col gap-3 pt-2 lg:text-[1.0625rem] lg:leading-7"
        >
          {isGm && session.recap && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary">{t("chronicle.published")}</Badge>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                <PencilIcon /> {t("chronicle.edit")}
              </Button>
            </div>
          )}
          {session.recap ? (
            <Markdown>{session.recap}</Markdown>
          ) : isGm ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
              <PencilIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t("chronicle.toWriteTitle")}</p>
                <p className="text-muted-foreground text-xs">{t("chronicle.toWriteHint")}</p>
              </div>
              <Badge variant="outline">{t("chronicle.toWrite")}</Badge>
              <Button type="button" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon /> {t("chronicle.write")}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm italic">{t("chronicle.noRecap")}</p>
          )}
          {quotes.map((quote) => (
            <blockquote key={quote.id} className="border-primary border-l-2 py-1 pl-3 italic">
              « {quote.text} »
              {quote.speaker && (
                <small className="text-muted-foreground block text-xs not-italic">
                  — {quote.speaker}
                </small>
              )}
            </blockquote>
          ))}
        </TabsContent>

        <TabsContent value="notebook" className="pt-2">
          {notebookCount === 0 && (
            <p className="text-muted-foreground text-sm">{t("chronicle.notebookEmpty")}</p>
          )}
          {events.length > 0 && (
            <NotebookTile icon={<SparklesIcon />} label={t("chronicle.events")}>
              <ul className="flex flex-col gap-1.5">
                {events.map((event) => (
                  <li key={event.eventId}>
                    <span className="font-semibold">{event.title}</span>
                    {event.description && (
                      <span className="text-muted-foreground"> — {event.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </NotebookTile>
          )}
          {facts.quests.length > 0 && (
            <NotebookTile icon={<FlagIcon />} label={t("chronicle.quests")}>
              <ul className="flex flex-col gap-1">
                {facts.quests.map((quest) => (
                  <li key={quest}>{quest}</li>
                ))}
              </ul>
            </NotebookTile>
          )}
          {facts.defeated.length > 0 && (
            <NotebookTile icon={<SwordsIcon />} label={t("chronicle.defeated")}>
              {facts.defeated.join(", ")}
            </NotebookTile>
          )}
          {loot.length > 0 && (
            <NotebookTile icon={<GemIcon />} label={t("chronicle.loot")}>
              <ul className="flex flex-col gap-1">
                {loot.map((item, index) => (
                  <li key={index}>{lootLabel(item)}</li>
                ))}
              </ul>
            </NotebookTile>
          )}
          {documents.length > 0 && (
            <NotebookTile icon={<FileTextIcon />} label={t("codex:handout.chronicle")}>
              <div className="flex flex-wrap gap-2">
                {documents.map((document) => (
                  <Thumb
                    key={document.entryId}
                    caption={document.name}
                    icon={<FileTextIcon />}
                    onClick={() => setOpened(document)}
                  >
                    {document.imageUrl && (
                      <img
                        src={document.imageUrl}
                        alt=""
                        className="size-full object-cover"
                        onError={(event) => (event.currentTarget.style.display = "none")}
                      />
                    )}
                  </Thumb>
                ))}
              </div>
            </NotebookTile>
          )}
          {visited.length > 0 && (
            <NotebookTile icon={<MapIcon />} label={t("chronicle.places")}>
              <div className="flex flex-wrap gap-2">
                {visited.map((reveal) => (
                  <Thumb
                    key={reveal.id}
                    caption={reveal.name}
                    icon={<MapIcon />}
                    onClick={() => setViewing(reveal)}
                  >
                    {reveal.imageUrl && (
                      <RevealedMapImage
                        reveal={reveal}
                        className="absolute top-1/2 left-0 w-full -translate-y-1/2"
                      />
                    )}
                  </Thumb>
                ))}
              </div>
            </NotebookTile>
          )}
        </TabsContent>

        {session.recap && (
          // Kept mounted: the tab label counts the entries it loads.
          <TabsContent value="journals" forceMount className="pt-2 data-[state=inactive]:hidden">
            <SessionJournal
              campaignId={campaignId}
              campaignName={campaignName}
              adventureId={adventureId}
              adventureTitle={adventureTitle}
              session={session}
              number={number}
              isGm={isGm}
              userId={userId}
              participants={participants}
              onSessionChange={onChange}
              onCount={setJournalCount}
            />
          </TabsContent>
        )}
      </Tabs>

      <ShownDocumentDialog
        campaignId={campaignId}
        document={opened}
        entry={opened ? codex.find((entry) => entry.id === opened.entryId) : undefined}
        onClose={() => setOpened(null)}
      />

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing && <RevealedMapView reveal={viewing} />}
        </DialogContent>
      </Dialog>

      {isGm && (
        <RecapEditorDialog
          open={editing}
          onOpenChange={setEditing}
          campaignId={campaignId}
          adventureId={adventureId}
          session={session}
          number={number}
          skeleton={() => recapSkeleton(facts)}
          onChange={onChange}
        />
      )}
    </article>
  );
}

/**
 * « Chronique » — the adventure told one session at a time, oldest first like
 * the chapters of a book, the latest open by default. Players read the
 * published recaps; the GM sees every ended session and writes / publishes its
 * recap.
 */
export function ChronicleCard({
  campaignId,
  campaignName,
  adventureId,
  adventureTitle,
  isGm,
  userId,
  sessions,
  participants,
  onChange,
}: Props) {
  const { t } = useTranslation("adventures", { keyPrefix: "chronicle" });
  // The recap's prefill says which quests moved during the session.
  const quests = useQuests(isGm ? campaignId : undefined, isGm);
  const numbers = useMemo(() => sessionNumbers(sessions, toMillis), [sessions]);
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => toMillis(a.startedAt) - toMillis(b.startedAt)),
    [sessions],
  );
  const shown = useMemo(() => ordered.filter((s) => isGm || s.recap), [ordered, isGm]);
  const publishedCount = sessions.filter((s) => s.recap).length;
  const [currentId, setCurrentId] = useState<string>();
  const [tab, setTab] = useState<ChronicleTab>("story");
  const [characters, setCharacters] = useState<Record<string, WithId<ReadyCharacter>>>({});

  // The participants' sheets, for the attendees' portraits on the banner.
  const characterKey = participants.map((p) => p.characterId).join(",");
  useEffect(() => {
    if (!characterKey) return;
    let cancelled = false;
    Promise.all(characterKey.split(",").map((id) => getCompanionSheet(id))).then((found) => {
      if (!cancelled) {
        setCharacters(Object.fromEntries(found.flatMap((c) => (c ? [[c.id, c]] : []))));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [characterKey]);

  // The latest session opens by default.
  const current = shown.find((s) => s.id === currentId) ?? shown.at(-1);
  const currentIndex = current ? shown.indexOf(current) : -1;
  const go = (to: number) => {
    const target = shown[to];
    if (target) setCurrentId(target.id);
  };
  const heading = (id: string) => {
    const session = ordered.find((s) => s.id === id);
    const number = numbers.get(id) ?? 1;
    return session?.title
      ? t("headingTitled", { number, title: session.title })
      : t("heading", { number });
  };
  const previous = shown[currentIndex - 1];
  const next = shown[currentIndex + 1];

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <BookOpenIcon className="size-4" /> {t("title")}
        </span>
      }
      description={isGm ? t("introGm") : t("intro")}
      storageKey="adv-chronicle"
      summary={t("count", { count: publishedCount })}
      action={publishedCount > 0 ? <Badge variant="secondary">{publishedCount}</Badge> : undefined}
      headerAction={
        publishedCount > 0 && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/campaigns/${campaignId}/adventures/${adventureId}/chronique`}>
              <BookOpenIcon />
              <span className="sm:hidden">{t("readAllShort")}</span>
              <span className="hidden sm:inline">{t("readAll")}</span>
            </Link>
          </Button>
        )
      }
      contentClassName="flex flex-col gap-4"
    >
      {shown.length === 0 && (
        <p className="text-muted-foreground text-sm">{isGm ? t("emptyGm") : t("empty")}</p>
      )}
      {current && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {ordered.length > 1 && (
            <nav aria-label={t("sessions")} className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!previous}
                aria-label={t("previousSession")}
                onClick={() => go(currentIndex - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <ol className="flex flex-1 flex-wrap justify-center gap-1.5">
                {ordered.map((session) => {
                  const number = numbers.get(session.id) ?? 1;
                  const target = shown.indexOf(session);
                  // A session whose recap is not out yet: dashed, nothing to open.
                  const pending = !session.recap;
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        aria-label={heading(session.id)}
                        aria-current={session.id === current.id ? "true" : undefined}
                        title={
                          target < 0
                            ? t("recapSoon")
                            : pending
                              ? `${heading(session.id)} — ${t("toWrite")}`
                              : heading(session.id)
                        }
                        onClick={() =>
                          target < 0 ? toast(t("recapPending", { number })) : go(target)
                        }
                        className={cn(
                          "focus-visible:ring-ring/50 size-8 rounded-full border text-xs font-bold transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                          session.id === current.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-accent",
                          pending && "text-muted-foreground border-dashed",
                          target < 0 && "opacity-60",
                        )}
                      >
                        {number}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!next}
                aria-label={t("nextSession")}
                onClick={() => go(currentIndex + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </nav>
          )}
          <ChronicleEntry
            key={current.id}
            campaignId={campaignId}
            campaignName={campaignName}
            adventureId={adventureId}
            adventureTitle={adventureTitle}
            isGm={isGm}
            userId={userId}
            session={current}
            number={numbers.get(current.id) ?? 1}
            participants={participants}
            quests={quests}
            characters={characters}
            tab={tab}
            onTabChange={setTab}
            onChange={onChange}
          />
        </div>
      )}
    </CollapsibleCard>
  );
}
