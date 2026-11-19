import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  CompassIcon,
  FlameIcon,
  HourglassIcon,
  LockIcon,
  PencilLineIcon,
  PlayIcon,
  PlusIcon,
  SwordsIcon,
} from "lucide-react";
import {
  ADVENTURE_DISPLAY_STATUS_LABELS,
  adventureDisplayStatus,
  playerCanSeeAdventure,
  type Adventure,
  type AdventureStatus,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CampaignCard } from "@/components/campaign/campaign-card";
import type { WithId } from "@/lib/collections";
import { currentLanguage } from "@/i18n";
import { recapExcerpt } from "@/lib/recap";
import { hasUnreadRecap } from "@/lib/recap-seen";
import type { AdventurePlays } from "@/lib/sessions";
import { cn } from "@/lib/utils";

const adventurePath = (campaignId: string, adventureId: string) =>
  `/campaigns/${campaignId}/adventures/${adventureId}`;

const sessionPath = (campaignId: string, adventure: WithId<Adventure>) =>
  `${adventurePath(campaignId, adventure.id)}/session/${adventure.liveSessionId}`;

/** A tile per status, tinted with one of the theme's chart colours. */
const STATUS_TILES: Record<
  AdventureStatus,
  { icon: ComponentType<{ className?: string }>; tint: string }
> = {
  active: { icon: FlameIcon, tint: "bg-chart-1/15 text-chart-1 border-chart-1/30" },
  completed: { icon: CheckIcon, tint: "bg-chart-2/15 text-chart-2 border-chart-2/30" },
  upcoming: { icon: HourglassIcon, tint: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  draft: { icon: PencilLineIcon, tint: "bg-muted text-muted-foreground border-dashed" },
};

/** The one played now first, then those played, those to come, the drafts. */
const STAGE = { live: 0, active: 1, completed: 2, upcoming: 3, draft: 4 } as const;
const byStage = (a: Adventure, b: Adventure) =>
  STAGE[adventureDisplayStatus(a)] - STAGE[adventureDisplayStatus(b)] || a.order - b.order;

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(currentLanguage(), { day: "numeric", month: "short" });

/**
 * « Séance en cours » and the way in, in green — or, between sessions, when the
 * last one was played.
 */
export function LiveBar({
  campaignId,
  adventure,
  plays,
  isGm,
  compact = false,
}: {
  campaignId: string;
  adventure: WithId<Adventure>;
  plays?: AdventurePlays;
  isGm: boolean;
  /** Without the adventure's name: under the page's header, on a phone. */
  compact?: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "detail" });
  if (!adventure.liveSessionId) {
    if (compact || !plays?.lastPlayedAt) return null;
    return (
      <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
        <ClockIcon className="size-3.5" />
        {t("lastSession", { date: shortDate(plays.lastPlayedAt), count: plays.played })}
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
      <span
        aria-hidden
        className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
      />
      <span className="min-w-0 flex-[1_1_12rem] text-sm">
        <span className="font-semibold">{t("liveNow")}</span>
        {!compact && (
          <span className="text-muted-foreground">
            {" "}
            · {t("liveWhich", { title: adventure.title, number: (plays?.played ?? 0) + 1 })}
          </span>
        )}
      </span>
      <Button asChild size="sm" className="max-sm:w-full">
        <Link to={sessionPath(campaignId, adventure)}>
          <PlayIcon /> {isGm ? t("resume") : t("join")}
        </Link>
      </Button>
    </div>
  );
}

/** At the top: the adventure in progress, the last recap, and the live session. */
export function CurrentAdventure({
  campaignId,
  adventure,
  plays,
  isGm,
}: {
  campaignId: string;
  adventure: WithId<Adventure>;
  plays?: AdventurePlays;
  isGm: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "detail" });
  const excerpt = plays?.lastRecap ? recapExcerpt(plays.lastRecap) : "";
  const unread = !isGm && hasUnreadRecap(adventure);
  return (
    <section
      aria-labelledby="current-adventure"
      className="bg-card relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5"
    >
      <div
        aria-hidden
        className="from-chart-1/15 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
      />
      <div className="relative">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t("current")}
        </p>
        <h2 id="current-adventure" className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
          {adventure.title}
        </h2>
        {excerpt && (
          <p className="text-muted-foreground my-3 max-w-prose border-l-2 pl-3 text-sm">
            {excerpt}
          </p>
        )}
        <div className={cn("flex flex-wrap items-center gap-2", !excerpt && "mt-3")}>
          {unread && <Badge variant="secondary">{t("newRecap")}</Badge>}
          {plays?.lastRecap && (
            <Button asChild size="sm" variant="outline">
              <Link to={`${adventurePath(campaignId, adventure.id)}/chronique`}>
                <BookOpenIcon /> {t("readChronicle")}
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to={adventurePath(campaignId, adventure.id)}>
              <CompassIcon /> {t("openAdventure")}
            </Link>
          </Button>
        </div>
        <LiveBar campaignId={campaignId} adventure={adventure} plays={plays} isGm={isGm} />
      </div>
    </section>
  );
}

/**
 * Every adventure, one line each: a tile, the title, sessions played and the
 * last date, the status. One a player cannot open yet is dashed, with a lock.
 */
export function AdventuresCard({
  campaignId,
  adventures,
  plays,
  isGm,
  titled = true,
}: {
  campaignId: string;
  adventures: WithId<Adventure>[];
  plays: Record<string, AdventurePlays>;
  isGm: boolean;
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "detail" });
  const actions = (
    <div className="flex flex-wrap justify-end gap-1">
      {/* Once a recap is out, the whole campaign reads as a book. */}
      {adventures.some((adventure) => adventure.lastRecapAt) && (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/campaigns/${campaignId}/chronique`}>
            <BookOpenIcon /> {t("book")}
          </Link>
        </Button>
      )}
      {isGm && (
        <Button asChild size="sm">
          <Link to={`/campaigns/${campaignId}/adventures/new`}>
            <PlusIcon /> {t("newAdventure")}
          </Link>
        </Button>
      )}
    </div>
  );
  return (
    <CampaignCard
      title={titled ? t("adventures") : undefined}
      icon={SwordsIcon}
      action={actions}
      contentClassName="flex flex-col gap-2"
    >
      {!titled && <div className="-mt-1 flex justify-end">{actions}</div>}
      {adventures.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noAdventures")}</p>
      )}
      {[...adventures].sort(byStage).map((adventure) => (
        <AdventureRow
          key={adventure.id}
          campaignId={campaignId}
          adventure={adventure}
          plays={plays[adventure.id]}
          isGm={isGm}
        />
      ))}
    </CampaignCard>
  );
}

function AdventureRow({
  campaignId,
  adventure,
  plays,
  isGm,
}: {
  campaignId: string;
  adventure: WithId<Adventure>;
  plays?: AdventurePlays;
  isGm: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "detail" });
  const display = adventureDisplayStatus(adventure);
  const live = display === "live";
  // Players open every adventure they see: the chronicle is readable between
  // sessions, the rest of the content stays locked there.
  const canOpen = isGm || playerCanSeeAdventure(adventure);
  const unread = !isGm && hasUnreadRecap(adventure);
  const tile = STATUS_TILES[adventure.status];
  const played = plays?.played ?? 0;
  const line =
    played > 0
      ? t("played", {
          count: played,
          date: plays?.lastPlayedAt ? shortDate(plays.lastPlayedAt) : "",
        })
      : canOpen
        ? t("notPlayed")
        : t("lockedAdventure");

  const inner = (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg border", tile.tint)}>
        <tile.icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{adventure.title}</span>
          {!canOpen && <LockIcon className="size-3.5 shrink-0" />}
        </span>
        <span className="text-muted-foreground block truncate text-xs">{line}</span>
      </span>
      {/* Stacked on the right: the title keeps its width on a phone. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        {unread && <Badge variant="secondary">{t("newRecap")}</Badge>}
        <Badge
          variant="outline"
          className={cn(
            live &&
              "gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            display === "active" && "border-chart-1/40 text-chart-1",
          )}
        >
          {live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
          {ADVENTURE_DISPLAY_STATUS_LABELS[display]}
        </Badge>
      </span>
    </>
  );
  const row = "flex min-w-0 items-center gap-3 rounded-lg border p-2.5 text-sm";
  return canOpen ? (
    <Link
      to={adventurePath(campaignId, adventure.id)}
      className={cn(row, "bg-muted/30 hover:bg-muted/60 transition-colors")}
    >
      {inner}
    </Link>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(row, "text-muted-foreground border-dashed")}>{inner}</div>
      </TooltipTrigger>
      <TooltipContent>{t("lockedAdventure")}</TooltipContent>
    </Tooltip>
  );
}
