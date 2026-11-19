import { useState, type ReactNode } from "react";
import {
  BellRingIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudFogIcon,
  EyeIcon,
  ImageOffIcon,
  MonitorIcon,
  MonitorOffIcon,
  PlusIcon,
  TimerIcon,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AdventureLocation,
  AdventureParticipant,
  LiveSession,
  SessionCombatant,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionActions } from "@/hooks/use-session-actions";
import type { SessionStory } from "@/hooks/use-session-story";
import { hideShownDocument } from "@/lib/codex";
import { initials } from "@/lib/format";
import { momentLabel, stepGameTime } from "@/lib/game-time";
import type { WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { combatantColor } from "@/lib/combatant-color";

/** A titled card of the GM panel. */
export function PanelSection({
  title,
  action,
  children,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="bg-card overflow-hidden rounded-lg border">
      <header className="flex min-h-10 items-center gap-2 border-b px-3 py-1.5">
        <h3 className="text-muted-foreground flex-1 text-[11px] font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Thumb({ location, className }: { location: AdventureLocation; className?: string }) {
  return location.imageUrl ? (
    <img
      src={location.imageUrl}
      alt=""
      className={cn("shrink-0 rounded-md border object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "bg-muted/50 text-muted-foreground grid shrink-0 place-items-center rounded-md border",
        className,
      )}
    >
      <ImageOffIcon className="size-4" />
    </span>
  );
}

/** Visible or under the fog: a two-state switch. */
function FogSwitch({ location }: { location: WithId<AdventureLocation> }) {
  const { t } = useTranslation("session", { keyPrefix: "scene" });
  const { onSetLocationHidden } = useSessionActions();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "h-7 shrink-0 rounded-full",
        !location.hidden && "text-emerald-700 dark:text-emerald-300",
      )}
      aria-pressed={!location.hidden}
      onClick={() => onSetLocationHidden(location.id, !location.hidden)}
    >
      {location.hidden ? <CloudFogIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      {t(location.hidden ? "fog" : "visible")}
    </Button>
  );
}

/**
 * Where the party is: the location shown (no preview — it's on the map
 * already), and the others, each opening a preview with « Montrer ».
 */
function LocationSection({
  session,
  locations,
}: {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
}) {
  const { t } = useTranslation("session", { keyPrefix: "scene" });
  const { onLocation } = useSessionActions();
  const [pending, setPending] = useState<string | null>(null);
  const current = locations.find((l) => l.id === session.currentLocationId);
  const others = locations.filter((l) => l.id !== session.currentLocationId);

  return (
    <PanelSection
      id="gm-scene-location"
      title={t("location")}
      action={
        current && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => onLocation(null)}
          >
            {t("hideMap")}
          </Button>
        )
      }
    >
      {current ? (
        <div className="flex items-center gap-2.5 p-2.5">
          <Thumb location={current} className="h-12 w-18" />
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-xs">{t("shownToPlayers")}</div>
            <div className="truncate font-semibold">{current.name}</div>
          </div>
          <FogSwitch location={current} />
        </div>
      ) : (
        <p className="text-muted-foreground p-3 text-sm">{t("noneShown")}</p>
      )}
      {locations.length === 0 && (
        <p className="text-muted-foreground p-3 text-sm">{t("noLocations")}</p>
      )}
      <ul className="divide-y border-t">
        {others.map((location) => {
          const open = pending === location.id;
          return (
            <li key={location.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setPending(open ? null : location.id)}
                className="hover:bg-accent/40 flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
              >
                <Thumb location={location} className="h-9 w-13" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{location.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t(location.hidden ? "arrivesFogged" : "arrivesVisible")}
                  </span>
                </span>
                {open ? (
                  <ChevronDownIcon className="text-muted-foreground size-4" />
                ) : (
                  <ChevronRightIcon className="text-muted-foreground size-4" />
                )}
              </button>
              {open && (
                // One column as wide as the panel: the image's natural width must not push it.
                <div className="bg-muted/20 grid grid-cols-1 gap-2 border-t p-2.5">
                  <Thumb location={location} className="aspect-video w-full" />
                  {location.description && (
                    <p className="text-muted-foreground text-xs whitespace-pre-line">
                      {location.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <FogSwitch location={location} />
                    <span className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onLocation(location.id);
                        setPending(null);
                      }}
                    >
                      {t("show")}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}

/**
 * Who stands on the map: the tokens placed, and « Ajouter un pion » for the
 * characters not there yet — even out of combat — and the combatants taken
 * off it. A token is deleted from the map itself (a click on it).
 */
function TokensSection({
  session,
  participants,
  combatants,
}: {
  session: WithId<LiveSession>;
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
}) {
  const { t } = useTranslation("session", { keyPrefix: "scene" });
  const { onPlaceParticipant, onToggleCombatantMap } = useSessionActions();
  const placed = combatants.filter((c) => c.onMap);
  const tokenOf = (p: AdventureParticipant) =>
    combatants.find((c) => c.kind === "participant" && c.refId === p.characterId);
  const partyIds = new Set(participants.map((p) => p.characterId));
  const party = participants.filter((p) => !tokenOf(p)?.onMap);
  const others = combatants.filter(
    (c) => !c.onMap && !(c.kind === "participant" && partyIds.has(c.refId)),
  );
  const hasMap = Boolean(session.currentLocationId);

  return (
    <PanelSection
      id="gm-scene-tokens"
      title={t("tokens")}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-7" disabled={!hasMap}>
              <PlusIcon /> {t("addToken")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {party.length + others.length === 0 && (
              <DropdownMenuLabel className="text-muted-foreground font-normal">
                {t("allPlaced")}
              </DropdownMenuLabel>
            )}
            {party.length > 0 && (
              <DropdownMenuLabel className="font-normal">{t("party")}</DropdownMenuLabel>
            )}
            {party.map((participant) => (
              <DropdownMenuItem
                key={participant.id}
                onSelect={() => onPlaceParticipant(participant)}
              >
                {participant.characterName}
              </DropdownMenuItem>
            ))}
            {others.length > 0 && (
              <>
                {party.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="font-normal">{t("others")}</DropdownMenuLabel>
                {others.map((combatant) => (
                  <DropdownMenuItem
                    key={combatant.id}
                    onSelect={() => onToggleCombatantMap(combatant.id, true)}
                  >
                    {combatant.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {!hasMap ? (
        <p className="text-muted-foreground p-3 text-sm">{t("noMap")}</p>
      ) : placed.length === 0 ? (
        <p className="text-muted-foreground p-3 text-sm">{t("noToken")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 p-2.5">
          {placed.map((combatant) => (
            <li
              key={combatant.id}
              className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs"
            >
              <span
                className="grid size-5 place-items-center rounded-full text-[9px] font-bold text-white"
                style={{
                  backgroundColor: combatantColor(combatant),
                }}
              >
                {initials(combatant.name)}
              </span>
              {combatant.name}
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}

/** The game clock, with quick jumps, and the beats planned on it. */
function ClockSection({ session, story }: { session: WithId<LiveSession>; story: SessionStory }) {
  const { t } = useTranslation("session", { keyPrefix: "scene" });
  const { onClock } = useSessionActions();
  const now = { day: session.gameDay, time: session.clockLabel };
  const timed = story.items.filter(
    (i) => i.kind === "event" && !i.revealed && (i.event.dueDay != null || i.event.dueTime),
  );
  return (
    <PanelSection
      id="gm-scene-clock"
      title={t("clock")}
      action={
        session.gameDate && (
          <span className="text-muted-foreground text-xs">{session.gameDate}</span>
        )
      }
    >
      <div className="grid gap-2 p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-sm font-semibold tabular-nums">
            {t("now", { day: now.day ?? 1, time: now.time ?? "--:--" })}
          </span>
          {([10, 60, 480] as const).map((minutes) => (
            <Button
              key={minutes}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => onClock(stepGameTime(now, minutes))}
            >
              {t(`step.${minutes}`)}
            </Button>
          ))}
        </div>
        {timed.map(
          (item) =>
            item.kind === "event" && (
              <p
                key={item.key}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  item.due
                    ? "font-semibold text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground",
                )}
              >
                {item.due ? (
                  <BellRingIcon className="size-3.5" />
                ) : (
                  <TimerIcon className="size-3.5" />
                )}
                {item.title} · {momentLabel({ day: item.event.dueDay, time: item.event.dueTime })}
              </p>
            ),
        )}
      </div>
    </PanelSection>
  );
}

/** What's on the players' screens, if anything — shown from the « Récit » tab. */
function DocumentSection({ session }: { session: WithId<LiveSession> }) {
  const { t } = useTranslation("session", { keyPrefix: "scene" });
  const shown = session.shownDocument;
  return (
    <PanelSection id="gm-scene-document" title={t("document")}>
      <div className="flex items-center gap-2 p-2.5 text-sm">
        {shown ? (
          <>
            <MonitorIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("showing", { name: shown.name })}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() =>
                hideShownDocument(session.campaignId, session.adventureId, session.id).catch(() =>
                  toast.error(t("failed")),
                )
              }
            >
              <MonitorOffIcon /> {t("stopShowing")}
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">{t("noDocument")}</span>
        )}
      </div>
    </PanelSection>
  );
}

/** « Scène » tab: where (location, fog), who (tokens), when (clock), what's on screen. */
export function SceneTab({
  session,
  locations,
  participants,
  combatants,
  story,
  map,
}: {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
  story: SessionStory;
  /** Phone only: the GM's map, on top of the tab. */
  map?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {map}
      <LocationSection session={session} locations={locations} />
      <TokensSection session={session} participants={participants} combatants={combatants} />
      <ClockSection session={session} story={story} />
      <DocumentSection session={session} />
    </div>
  );
}
