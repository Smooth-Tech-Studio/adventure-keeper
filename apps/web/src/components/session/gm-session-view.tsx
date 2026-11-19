import { useCallback, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  PaintbrushVertical,
  EraserIcon,
  LinkIcon,
  MapIcon,
  MapPinIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AdventureEnemy,
  AdventureNpc,
  AdventureLocation,
  AdventureParticipant,
  ReadyCharacter,
  LiveSession,
  SessionCombatant,
  SessionMapReveal,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CombatHud } from "@/components/session/combat-hud";
import { GameClock } from "@/components/session/game-clock";
import { GameDatePill, QuoteButton } from "@/components/session/quote-button";
import { GmControlPanel } from "@/components/session/gm-control-panel";
import { useGmPanelTabs, type GmPanelProps } from "@/components/session/gm-panel/use-gm-panel-tabs";
import { PhoneLayout } from "@/components/session/player-session/phone-layout";
import { InspectCharacterDialog } from "@/components/session/inspect-character-dialog";
import { SessionLocationPill } from "@/components/session/session-location-pill";
import { SessionMap } from "@/components/session/session-map";
import {
  FullscreenButton,
  ProjectMapMenuItem,
  ProjectingBadge,
  SessionPaneFrame,
  SessionPaneMenuItems,
  SessionViewBar,
} from "@/components/session/session-pane";
import { SessionPartyGrid } from "@/components/session/session-party-grid";
import { SessionStage } from "@/components/session/session-stage";
import { TurnOrderStrip } from "@/components/session/turn-order-strip";
import { useSessionActions } from "@/hooks/use-session-actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { emptyMask, filledMask, packMask, type FogGrid } from "@/lib/fog-grid";
import { sessionPath, type SessionPane } from "@/lib/session-panes";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";

interface Props {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
  enemies: WithId<AdventureEnemy>[];
  npcs: WithId<AdventureNpc>[];
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
  combatantsById: Record<string, WithId<SessionCombatant>>;
  charactersById: Record<string, WithId<ReadyCharacter>>;
  conditionsEnabled: boolean;
  /** Fog of war — reveal state for the current (hidden) location. */
  reveal: WithId<SessionMapReveal> | null;
  /**
   * Only this block, alone in its own tab. `carte` (the players' view) is not
   * the GM view's to draw — see `PlayerStage`.
   */
  pane?: Exclude<SessionPane, "carte">;
  /** Main view only: blocks open in another tab of this browser, left out here. */
  detached?: ReadonlySet<SessionPane>;
}

export function GmSessionView({
  session,
  locations,
  enemies,
  npcs,
  participants,
  combatants,
  combatantsById,
  charactersById,
  conditionsEnabled,
  reveal,
  pane,
  detached,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "gm" });
  const { onClock, onCombatantHitPoints, onMoveToken, onNext, onDestroyCombatant, onCommitFog } =
    useSessionActions();
  const wide = useMediaQuery("(min-width: 1024px)");
  const { id: campaignId, adventureId } = useParams<{ id: string; adventureId: string }>();
  // The main view's link, even from a pane tab.
  const sessionUrl = `${window.location.origin}${sessionPath(campaignId!, adventureId!, session.id)}`;
  const combat = session.combat;
  const [showPanel, setShowPanel] = useStoredFlag("session-gm-panel", true);
  const [showParty, setShowParty] = useStoredFlag("session-gm-party", true);
  const mapShown = !detached?.has("carte-mj");
  const panelShown = showPanel && !detached?.has("outils");
  const projecting = !!detached?.has("carte");
  const [viewedCharacterId, setViewedCharacterId] = useState<string | null>(null);
  const [brush, setBrush] = useState<"none" | "eraser" | "fog">("none");
  const eraserActive = brush === "eraser";
  const fogBrushActive = brush === "fog";
  const brushing = eraserActive || fogBrushActive;
  const [brushRadius, setBrushRadius] = useState(0.06);
  // The squares: each one's own choice, on this device.
  const [showGrid, setShowGrid] = useStoredFlag("session-map-grid", false);
  const [fogGrid, setFogGrid] = useState<FogGrid | null>(null);
  // Stable identity — SessionMap re-fires its "grid ready" effect whenever this
  // callback's reference changes, so an inline arrow here would loop forever.
  const onGridReady = useCallback(
    (cols: number, rows: number) =>
      setFogGrid((prev) =>
        prev && prev.cols === cols && prev.rows === rows ? prev : { cols, rows },
      ),
    [],
  );

  const currentLocation = locations.find((l) => l.id === session.currentLocationId);
  const hiddenLocation = currentLocation?.hidden ?? false;
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));
  const combatantByRef = new Map(combatants.map((c) => [c.refId, c]));

  const fogTools = hiddenLocation ? (
    <>
      {brushing && (
        <div
          id="session-brush-size"
          className="bg-background/90 flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur"
        >
          <span className="text-muted-foreground text-xs">{t("radius")}</span>
          <Slider
            min={0.01}
            max={0.1}
            step={0.005}
            value={[brushRadius]}
            onValueChange={([v]) => setBrushRadius(v)}
            aria-label={t("brushRadius")}
            className="w-24"
          />
        </div>
      )}
      <Toggle
        id="session-fog-eraser"
        variant="outline"
        size="sm"
        className="bg-background/90 size-8 rounded-full p-0 backdrop-blur"
        aria-label={t("eraser")}
        pressed={eraserActive}
        onPressedChange={(on) => setBrush(on ? "eraser" : "none")}
      >
        <EraserIcon className="size-4" />
      </Toggle>
      <Toggle
        id="session-fog-brush"
        variant="outline"
        size="sm"
        className="bg-background/90 size-8 rounded-full p-0 backdrop-blur"
        aria-label={t("fogBrush")}
        pressed={fogBrushActive}
        onPressedChange={(on) => setBrush(on ? "fog" : "none")}
      >
        <PaintbrushVertical className="size-4" />
      </Toggle>
    </>
  ) : null;

  const copyLinkItem = (
    <DropdownMenuItem
      onSelect={() => {
        navigator.clipboard
          ?.writeText(sessionUrl)
          .then(() => toast.success(t("linkCopied")))
          .catch(() => toast.error(t("copyFailed")));
      }}
    >
      <LinkIcon /> {t("copyLink")}
    </DropdownMenuItem>
  );
  // Main view only: what this screen shows, and what goes to another tab.
  const viewItems = !pane && (
    <>
      {!detached?.has("outils") && (
        <DropdownMenuCheckboxItem
          checked={showPanel}
          onCheckedChange={(checked) => setShowPanel(checked === true)}
        >
          {t("gmPanel")}
        </DropdownMenuCheckboxItem>
      )}
      <DropdownMenuCheckboxItem
        checked={showParty}
        onCheckedChange={(checked) => setShowParty(checked === true)}
      >
        {t("playerList")}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <ProjectMapMenuItem />
      <SessionPaneMenuItems
        panes={[
          { pane: "carte-mj", label: t("gmMap") },
          { pane: "outils", label: t("gmPanel") },
        ]}
      />
    </>
  );
  const menu = (content: ReactNode) => (
    <div id="session-stage-menu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="bg-background/90 size-8 rounded-full backdrop-blur"
            aria-label={t("mapActions")}
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {content}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const stage = (
    <SessionStage
      className={pane ? "max-lg:aspect-auto" : undefined}
      map={
        <SessionMap
          id="session-map"
          fill
          imageUrl={currentLocation?.imageUrl}
          combatants={combatants}
          canEdit
          onMove={onMoveToken}
          onDestroyToken={onDestroyCombatant}
          hidden={hiddenLocation}
          reveal={reveal}
          fogRole="gm"
          eraserActive={eraserActive && hiddenLocation}
          fogBrushActive={fogBrushActive && hiddenLocation}
          brushRadius={brushRadius}
          onCommitFog={onCommitFog}
          onGridReady={onGridReady}
          mapScale={currentLocation?.scale}
          showGrid={showGrid}
          realtime={!!session.realtime}
        />
      }
      location={<SessionLocationPill name={currentLocation?.name} />}
      clock={
        <>
          {/* No −/+ here: the « Scène » tab steps the time; a tap still sets it. */}
          <GameClock
            value={{ day: session.gameDay, time: session.clockLabel }}
            onChange={onClock}
            steps={false}
          />
          <GameDatePill value={session.gameDate} />
          <QuoteButton session={session} speakers={participants.map((p) => p.characterName)} />
        </>
      }
      turnOrder={
        combat && (
          <TurnOrderStrip
            id="session-turn-order"
            combat={combat}
            combatantsById={combatantsById}
            className="max-w-full"
          />
        )
      }
      combatHud={
        // The panel's « Combat » tab (or the phone's) does this job when it's on screen.
        combat &&
        (pane === "carte-mj" || (wide && !panelShown)) && (
          <CombatHud
            combat={combat}
            combatantsById={combatantsById}
            canControl
            onNext={onNext}
            onHitPoints={onCombatantHitPoints}
            onDestroy={onDestroyCombatant}
          />
        )
      }
      actions={
        <>
          {projecting && <ProjectingBadge />}
          {fogTools}
          {pane && <FullscreenButton />}
          {menu(
            <>
              {/* What this screen shows; the rest has its own place (« Scène », the fog buttons). */}
              {(currentLocation?.scale || viewItems) && (
                <>
                  <DropdownMenuLabel className="font-normal">{t("display")}</DropdownMenuLabel>
                  {currentLocation?.scale && (
                    <DropdownMenuCheckboxItem
                      checked={showGrid}
                      onCheckedChange={(checked) => setShowGrid(checked === true)}
                    >
                      {t("showGrid")}
                    </DropdownMenuCheckboxItem>
                  )}
                  {viewItems}
                  <DropdownMenuSeparator />
                </>
              )}
              {copyLinkItem}

              {hiddenLocation && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                    <EraserIcon className="size-3.5" /> {t("hiddenLocation")}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!fogGrid}
                    onSelect={() =>
                      fogGrid &&
                      onCommitFog(
                        packMask(filledMask(fogGrid.cols, fogGrid.rows)),
                        fogGrid.cols,
                        fogGrid.rows,
                      )
                    }
                  >
                    {t("revealAll")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!fogGrid}
                    onSelect={() =>
                      fogGrid &&
                      onCommitFog(
                        packMask(emptyMask(fogGrid.cols, fogGrid.rows)),
                        fogGrid.cols,
                        fogGrid.rows,
                      )
                    }
                  >
                    {t("hideAll")}
                  </DropdownMenuItem>
                </>
              )}
            </>,
          )}
        </>
      }
    />
  );
  const panelProps: GmPanelProps = {
    session,
    locations,
    enemies,
    npcs,
    participants,
    combatants,
    charactersById,
    locationOptions,
    conditionsEnabled,
    onInspect: setViewedCharacterId,
  };
  const panel = <GmControlPanel {...panelProps} />;

  if (pane === "carte-mj") return <SessionPaneFrame>{stage}</SessionPaneFrame>;
  if (pane === "outils")
    return <SessionPaneFrame className="mx-auto max-w-[96rem]">{panel}</SessionPaneFrame>;

  const inspect = (
    <InspectCharacterDialog
      characterId={viewedCharacterId}
      charactersById={charactersById}
      participants={participants}
      onClose={() => setViewedCharacterId(null)}
      conditionsEnabled={conditionsEnabled}
    />
  );
  if (!wide) {
    return (
      <>
        <GmPhone
          panelProps={panelProps}
          map={stage}
          party={
            <SessionPartyGrid
              participants={participants}
              charactersById={charactersById}
              combatantByRef={combatantByRef}
              onSelect={setViewedCharacterId}
              showPassivePerception
              emptyLabel={t("noPlayer")}
              layout="column"
              className="grid-cols-1"
            />
          }
          locationName={currentLocation?.name}
        />
        {inspect}
      </>
    );
  }

  const party = (
    <SessionPartyGrid
      participants={participants}
      charactersById={charactersById}
      combatantByRef={combatantByRef}
      onSelect={setViewedCharacterId}
      showPassivePerception
      emptyLabel={t("noPlayer")}
      layout={mapShown ? "strip" : "column"}
    />
  );

  return (
    <div id="session-view" className="flex flex-col gap-3 px-3 py-3 lg:h-full lg:overflow-hidden">
      {/* Carte ouverte dans un autre onglet : un bandeau garde le menu. */}
      {!mapShown && (
        <SessionViewBar
          label={
            <>
              <MapIcon className="size-4 shrink-0" />
              <span className="truncate">{t("mapElsewhere")}</span>
            </>
          }
        >
          {projecting && <ProjectingBadge />}
          {menu(
            <>
              {viewItems && (
                <>
                  <DropdownMenuLabel className="font-normal">{t("display")}</DropdownMenuLabel>
                  {viewItems}
                  <DropdownMenuSeparator />
                </>
              )}
              {copyLinkItem}
            </>,
          )}
        </SessionViewBar>
      )}
      {/* Zone centrale : carte + panneau MJ ----------------------------- */}
      <div
        id="session-main"
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          mapShown
            ? panelShown && "lg:grid-cols-[minmax(0,1fr)_22rem]"
            : showParty && panelShown && "lg:grid-cols-[16rem_minmax(0,1fr)]",
        )}
      >
        {mapShown ? (
          /* Zone de jeu (carte) + joueurs, empilés verticalement -------- */
          <div
            id="session-left"
            className={cn("grid min-h-0 gap-3", showParty ? "grid-rows-[1fr_auto]" : "grid-rows-1")}
          >
            {stage}
            {showParty && party}
          </div>
        ) : (
          showParty && (
            /* Sans carte : les joueurs en colonne, le panneau s'élargit -- */
            <div id="session-left" className="flex min-h-0 flex-col">
              {party}
            </div>
          )
        )}

        {panelShown && panel}
      </div>

      {inspect}
    </div>
  );
}

/**
 * The GM's phone: a remote. The players' map runs on another screen (the
 * « Carte » tab, projected); here, one tab at a time, and the map on « Scène ».
 */
function GmPhone({
  panelProps,
  map,
  party,
  locationName,
}: {
  panelProps: GmPanelProps;
  map: ReactNode;
  party: ReactNode;
  locationName?: string;
}) {
  const { t } = useTranslation("session", { keyPrefix: "gm" });
  const { tabs, active, setActive } = useGmPanelTabs(panelProps, { map, party });
  const { session } = panelProps;
  const combat = session.combat;
  return (
    <PhoneLayout
      tabs={tabs}
      active={active}
      onActiveChange={setActive}
      header={
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-[11px]">
              {combat ? t("tabs.combatRound", { round: combat.round }) : t("exploration")}
            </div>
            <div className="flex items-center gap-1 truncate text-sm font-semibold">
              <MapPinIcon className="size-3.5 shrink-0" />
              {locationName ?? t("none")}
            </div>
          </div>
          <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
            {session.clockLabel ?? "--:--"}
          </span>
        </div>
      }
    />
  );
}
