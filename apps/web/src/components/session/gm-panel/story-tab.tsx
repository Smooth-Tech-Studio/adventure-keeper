import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRingIcon,
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  MonitorIcon,
  MonitorOffIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { QUEST_STATUSES, type CodexEntry, type LiveSession } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CODEX_KIND_ICONS } from "@/components/codex/codex-kinds";
import { codexPath } from "@/hooks/use-codex";
import type { SessionStory, StoryItem, StoryKind } from "@/hooks/use-session-story";
import { getCodexSecret, hideShownDocument, showDocument } from "@/lib/codex";
import { momentLabel } from "@/lib/game-time";
import type { WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";

type Filter = "all" | StoryKind;

function StoryIcon({ item, className }: { item: StoryItem; className?: string }) {
  if (item.kind === "event") return <SparklesIcon className={className} />;
  if (item.kind === "quest") return <ScrollTextIcon className={className} />;
  const Icon = CODEX_KIND_ICONS[item.entry.kind];
  return <Icon className={className} />;
}

const showable = (entry: CodexEntry) => Boolean(entry.imageUrl || entry.url);

/** The one reveal control, the same for events, codex entries and quests. */
export function RevealButton({
  item,
  story,
  size = "sm",
}: {
  item: StoryItem;
  story: SessionStory;
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation("session", { keyPrefix: "story" });
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={item.revealed}
      aria-label={
        item.revealed
          ? t("hideWhat", { title: item.title })
          : t("revealWhat", { title: item.title })
      }
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        await story.toggle(item);
        setBusy(false);
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap transition-colors disabled:opacity-50",
        size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs",
        item.revealed
          ? "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-500/60 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200",
      )}
    >
      {item.revealed ? (
        <>
          <CheckIcon className="size-3.5" /> {t(size === "lg" ? "revealedHide" : "revealedShort")}
        </>
      ) : (
        t(size === "lg" ? "revealToPlayers" : "reveal")
      )}
    </button>
  );
}

function StoryRow({
  item,
  story,
  onOpen,
}: {
  item: StoryItem;
  story: SessionStory;
  onOpen: () => void;
}) {
  const { t } = useTranslation(["session", "codex", "quests"]);
  const parts = [
    item.kind === "codex"
      ? t(`codex:kinds.${item.entry.kind}`)
      : t(`session:story.kinds.${item.kind}`),
    item.kind === "quest" ? t(`quests:statuses.${item.quest.status}`) : null,
    t(item.revealed ? "session:story.seen" : "session:story.notSeen"),
    item.kind === "event" && !item.revealed ? item.event.trigger : null,
    item.kind === "event" && !item.revealed && (item.event.dueDay != null || item.event.dueTime)
      ? t("session:story.planned", {
          value: momentLabel({ day: item.event.dueDay, time: item.event.dueTime }),
        })
      : null,
  ].filter(Boolean);
  return (
    <li
      className={cn(
        "hover:bg-accent/40 flex cursor-pointer items-center gap-2.5 px-2.5 py-2",
        item.due && "bg-amber-500/10",
      )}
      onClick={onOpen}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg",
          item.due
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
            : item.revealed
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
        )}
      >
        {item.due ? (
          <BellRingIcon className="size-3.5" />
        ) : (
          <StoryIcon item={item} className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {item.title}
          </button>
          {item.due && (
            <span className="shrink-0 rounded border border-amber-500/60 px-1 text-[10px] font-bold text-amber-700 uppercase dark:text-amber-300">
              {t("session:story.due")}
            </span>
          )}
        </span>
        <span className="text-muted-foreground block truncate text-xs">{parts.join(" · ")}</span>
      </span>
      <RevealButton item={item} story={story} />
    </li>
  );
}

/** One item, opened: what the players see, the GM's secret, the quest's status. */
function StoryDialog({
  item,
  story,
  session,
  onClose,
}: {
  item: StoryItem | null;
  story: SessionStory;
  session: WithId<LiveSession>;
  onClose: () => void;
}) {
  const { t } = useTranslation(["session", "codex", "quests"]);
  const { campaignId, adventureId } = session;
  const entryId = item?.kind === "codex" ? item.entry.id : null;
  const [secret, setSecret] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!entryId) return;
    let live = true;
    getCodexSecret(campaignId, entryId)
      .then((text) => live && setSecret({ id: entryId, text }))
      .catch(() => live && setSecret({ id: entryId, text: "" }));
    return () => {
      live = false;
    };
  }, [campaignId, entryId]);

  const text =
    item?.kind === "event"
      ? item.event.description
      : item?.kind === "codex"
        ? item.entry.summary
        : item?.quest.summary;
  const gmSecret = item?.kind === "codex" && secret?.id === item.entry.id ? secret.text : "";
  const onScreen = item?.kind === "codex" && session.shownDocument?.entryId === item.entry.id;

  async function screen(entry: WithId<CodexEntry>) {
    try {
      if (onScreen) await hideShownDocument(campaignId, adventureId, session.id);
      else await showDocument(campaignId, adventureId, session.id, entry);
    } catch (error) {
      console.error(error);
      toast.error(t("session:story.failed"));
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto" id="story-dialog">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StoryIcon item={item} className="text-muted-foreground size-4 shrink-0" />{" "}
                {item.title}
              </DialogTitle>
              <DialogDescription>
                {[
                  item.kind === "codex"
                    ? t(`codex:kinds.${item.entry.kind}`)
                    : t(`session:story.kinds.${item.kind}`),
                  item.kind === "event" ? item.event.trigger : null,
                  item.kind === "event" && (item.event.dueDay != null || item.event.dueTime)
                    ? t("session:story.planned", {
                        value: momentLabel({ day: item.event.dueDay, time: item.event.dueTime }),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>

            <section className="grid gap-1">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("session:story.playersSee")}
              </h3>
              <p className="text-sm whitespace-pre-line">{text || t("session:story.noText")}</p>
            </section>

            {gmSecret && (
              <section className="grid gap-1">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("session:story.secret")}
                </h3>
                <p className="rounded-md border border-dashed border-red-500/50 bg-red-500/5 p-2 text-sm whitespace-pre-line">
                  <LockIcon className="mr-1 inline size-3.5" />
                  {gmSecret}
                </p>
                <p className="text-muted-foreground text-xs">{t("session:story.secretHint")}</p>
              </section>
            )}

            {item.kind === "quest" && (
              <section className="grid gap-1.5">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("session:story.status")}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {QUEST_STATUSES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={item.quest.status === s ? "default" : "outline"}
                      className="h-7 rounded-full"
                      onClick={() => story.setQuestStatus(item.quest, s)}
                    >
                      {t(`quests:statuses.${s}`)}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {item.kind === "codex" && showable(item.entry) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => screen(item.entry)}
                >
                  {onScreen ? <MonitorOffIcon /> : <MonitorIcon />}
                  {t(onScreen ? "session:story.stopShowing" : "session:story.show")}
                </Button>
              )}
              {item.kind === "codex" && (
                <Button asChild size="sm" variant="ghost">
                  <Link to={codexPath(campaignId, item.entry.id)} target="_blank">
                    <ExternalLinkIcon /> {t("session:story.openCodex")}
                  </Link>
                </Button>
              )}
              <span className="flex-1" />
              <RevealButton item={item} story={story} size="lg" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Récit » tab: events, codex and quests in one list — what rings now
 * first, then what's still hidden, then what the players already know.
 */
export function StoryTab({
  story,
  session,
}: {
  story: SessionStory;
  session: WithId<LiveSession>;
}) {
  const { t } = useTranslation("session", { keyPrefix: "story" });
  const [filter, setFilter] = useState<Filter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const match = (item: StoryItem) => filter === "all" || item.kind === filter;
  const items = story.items.filter(match);
  const open = story.items.find((i) => i.key === openKey) ?? null;

  const groups: [string, StoryItem[]][] = [
    [t("groups.due"), items.filter((i) => i.due)],
    [t("groups.hidden"), items.filter((i) => !i.revealed && !i.due)],
    [t("groups.shown"), items.filter((i) => i.revealed)],
  ];

  return (
    <div className="flex flex-col gap-3" id="gm-story">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filterLabel")}>
        {(["all", "event", "codex", "quest"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              filter === f ? "bg-foreground text-background border-foreground" : "bg-muted/40",
            )}
          >
            {t(`filters.${f}`)}{" "}
            <span className="opacity-60">
              {story.items.filter((i) => f === "all" || i.kind === f).length}
            </span>
          </button>
        ))}
      </div>

      {items.length === 0 && <p className="text-muted-foreground text-sm">{t("empty")}</p>}

      {groups.map(
        ([title, list]) =>
          list.length > 0 && (
            <section key={title} className="grid gap-1">
              <h3 className="text-muted-foreground px-0.5 text-[11px] font-semibold tracking-wide uppercase">
                {title}
              </h3>
              <ul className="bg-card divide-y overflow-hidden rounded-lg border">
                {list.map((item) => (
                  <StoryRow
                    key={item.key}
                    item={item}
                    story={story}
                    onOpen={() => setOpenKey(item.key)}
                  />
                ))}
              </ul>
            </section>
          ),
      )}

      <StoryDialog item={open} story={story} session={session} onClose={() => setOpenKey(null)} />
    </div>
  );
}
