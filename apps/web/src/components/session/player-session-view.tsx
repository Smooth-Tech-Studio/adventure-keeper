import { useState, type ReactNode } from "react";
import {
  PARTICIPANT_ROLLS_KEPT,
  type AdventureLocation,
  type Companion,
  type AdventureParticipant,
  type AdventureParticipantPlayerUpdate,
  type ReadyCharacter,
  type LiveSession,
  type SessionCombatant,
  type SessionMapReveal,
} from "@adventure-keeper/schemas";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  BackpackIcon,
  CastleIcon,
  Dice5Icon,
  MapIcon,
  MoreVerticalIcon,
  NotebookPenIcon,
  SparklesIcon,
  SwordsIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotesTab } from "@/systems/dnd2024/session/player-sheet/notes-tab";
import { SheetColumn, type SheetTab } from "@/components/session/player-session/desktop-layout";
import {
  RollSheet,
  type FreeRollSpec,
  type RollRecord,
} from "@/systems/dnd2024/session/player-session/roll-sheet";
import {
  EndTurnButton,
  MapCard,
  OrderDots,
  QuestList,
  ShownDocumentCard,
  TurnBanner,
} from "@/components/session/player-session/game-tab";
import { PhoneLayout, type PhoneTab } from "@/components/session/player-session/phone-layout";
import { HpBar, TempHpButton } from "@/systems/dnd2024/session/player-session/vitals";
import { PlayerStage } from "@/components/session/player-stage";
import {
  FullscreenButton,
  ProjectMapMenuItem,
  SessionPaneFrame,
  SessionPaneMenuItems,
  SessionViewBar,
} from "@/components/session/session-pane";
import { CompanionSheetDialog } from "@/components/session/companion-sheet-dialog";
import { SessionPartyGrid } from "@/components/session/session-party-grid";
import { useBufferedValue } from "@/hooks/use-buffered-writes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import type { SessionPane } from "@/lib/session-panes";
import { STEPPER_WRITE_MS } from "@/lib/write-buffer";
import type { CharacterItemsPatch, WithId } from "@/lib/collections";
import { turnOf } from "@/lib/combat-turn";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";
import { screensOf } from "@/systems/screens";
import type { PlayerSessionBlocks } from "@/systems/screen-types";

interface Props {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
  combatantsById: Record<string, WithId<SessionCombatant>>;
  charactersById: Record<string, WithId<ReadyCharacter>>;
  myParticipant: WithId<AdventureParticipant>;
  myCharacter: WithId<ReadyCharacter>;
  currentHitPoints: number;
  maxHitPoints: number;
  /** Fog-of-war reveal state for the current (hidden) location. */
  reveal: WithId<SessionMapReveal> | null;
  /** GM has turned on condition tracking for this adventure. */
  conditionsEnabled: boolean;
  onHitPointsChange: (value: number) => void;
  onNotesChange: (value: string) => void;
  onCharacterItemsChange: (patch: CharacterItemsPatch) => void;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onCashInXp: () => void;
  /**
   * HP and temporary HP go out at each click (a realtime room holds them):
   * no buffering then.
   */
  instantWrites?: boolean;
  onApplyLevel: (level: number) => void;
  /** The player ends their turn in the running fight. */
  onEndTurn: () => void;
  /** Patch the player's own token (its AC under Wild Shape). */
  onMyCombatantChange: (patch: { armorClass: number; size?: SessionCombatant["size"] }) => void;
  /** The familiar's HP, on its token. */
  onCompanionCombatantHp: (combatantId: string, value: number) => void;
  /** Bring the familiar into the running fight; resolves with its initiative. */
  onCompanionJoinCombat: (companion: Companion) => Promise<number | undefined>;
  /** Take the familiar's token out (dismissed). */
  onRemoveCompanionCombatant: (combatantId: string) => void;
  /** Only this block, alone in its own tab (`carte-mj` is the GM's: shown as `carte`). */
  pane?: SessionPane;
  /** Main view only: blocks open in another tab of this browser, left out here. */
  detached?: ReadonlySet<SessionPane>;
}

type PhoneTabId = "jeu" | "moi" | "sorts" | "sac" | "notes";
type SheetTabId = "actions" | "sorts" | "fiche" | "sac" | "notes";

/**
 * The player's session. On a phone: tabs at the bottom (Jeu, Moi, Sorts, Sac,
 * Groupe, Notes) and a dice button. On a computer: the map with the party
 * under it, and the sheet as a column beside it.
 */
export function PlayerSessionView({
  session,
  locations,
  participants,
  combatants,
  combatantsById,
  charactersById,
  myParticipant,
  myCharacter,
  currentHitPoints,
  maxHitPoints,
  reveal,
  conditionsEnabled,
  onHitPointsChange,
  onNotesChange,
  onCharacterItemsChange,
  onParticipantStateChange,
  onCashInXp,
  instantWrites = false,
  onApplyLevel,
  onEndTurn,
  onMyCombatantChange,
  onCompanionCombatantHp,
  onCompanionJoinCombat,
  onRemoveCompanionCombatant,
  pane,
  detached,
}: Props) {
  const { t } = useTranslation("session");
  const wide = useMediaQuery("(min-width: 1024px)");
  const combatantByRef = new Map(combatants.map((c) => [c.refId, c]));
  const others = participants.filter((p) => p.characterId !== myParticipant.characterId);
  const [phoneTab, setPhoneTab] = useState<PhoneTabId>("jeu");
  const [rollSpec, setRollSpec] = useState<RollSpec | FreeRollSpec | null>(null);
  // The rolls kept on the participant: they survive a reload, and the GM sees them.
  const [rollHistory, setRollHistory] = useState<RollRecord[]>(() => myParticipant.rolls ?? []);
  const [viewedCompanion, setViewedCompanion] = useState<WithId<ReadyCharacter> | null>(null);
  const [ownDice, setOwnDice] = useStoredFlag("session-own-dice", false);

  // HP +/−: shown at once, written once the clicks stop.
  const stepperDelay = instantWrites ? 0 : STEPPER_WRITE_MS;
  const [hitPoints, setHitPoints] = useBufferedValue(currentHitPoints, onHitPointsChange, {
    delay: stepperDelay,
  });
  // Same buffer for temporary HP: quick clicks add up before the write lands.
  const [temp, setTemp] = useBufferedValue(
    myParticipant.temporaryHitPoints ?? 0,
    (value) => onParticipantStateChange({ temporaryHitPoints: value }),
    { delay: stepperDelay },
  );
  // The player writes their own quests, signed with their character.
  const questReader = {
    isGm: false,
    uid: myParticipant.playerId,
    name: myParticipant.characterName,
  };
  const turn = turnOf(session.combat, combatantsById, myParticipant.characterId);

  // Off on a screen whose map is on the TV.
  const [showMap, setShowMap] = useStoredFlag("session-player-map", true);
  // Each viewer chooses for themself; only offered once the place has a scale.
  const [showGrid, setShowGrid] = useStoredFlag("session-map-grid", false);
  const hasScale = !!locations.find((l) => l.id === session.currentLocationId)?.scale;
  const stageProps = {
    showGrid,
    session,
    locations,
    combatants,
    combatantsById,
    reveal,
    currentUid: myParticipant.playerId,
  };
  if (pane === "carte" || pane === "carte-mj") {
    return (
      <SessionPaneFrame>
        <PlayerStage
          {...stageProps}
          className="max-lg:aspect-auto"
          actions={<FullscreenButton />}
        />
      </SessionPaneFrame>
    );
  }

  const mapDetached = !!detached?.has("carte") || !!detached?.has("carte-mj");
  const mapShown = showMap && !mapDetached;
  const sheetShown = !detached?.has("outils");

  // --- The blocks every layout arranges -------------------------------------
  const notes = <NotesTab participant={myParticipant} onNotesChange={onNotesChange} />;
  const party = (layout: "strip" | "column") => (
    <SessionPartyGrid
      participants={others}
      charactersById={charactersById}
      combatantByRef={combatantByRef}
      emptyLabel={t("player.noOther")}
      layout={layout}
      // A companion's sheet opens over the session.
      onSelect={(characterId) => setViewedCompanion(charactersById[characterId] ?? null)}
    />
  );
  const companionDialog = (
    <CompanionSheetDialog
      character={viewedCompanion}
      campaignId={session.campaignId}
      onClose={() => setViewedCompanion(null)}
    />
  );
  const mapMenu = (
    <div id="session-stage-menu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="bg-background/90 size-8 rounded-full backdrop-blur"
            aria-label={t("player.mapActions")}
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!mapDetached && (
            <>
              <DropdownMenuCheckboxItem
                checked={showMap}
                onCheckedChange={(checked) => setShowMap(checked === true)}
              >
                {t("player.showMap")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          )}
          {hasScale && (
            <>
              <DropdownMenuCheckboxItem
                checked={showGrid}
                onCheckedChange={(checked) => setShowGrid(checked === true)}
              >
                {t("player.showGrid")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          )}
          <ProjectMapMenuItem />
          <SessionPaneMenuItems panes={[{ pane: "outils", label: t("player.sheetTools") }]} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  const mapOrBar = mapShown ? (
    <PlayerStage {...stageProps} actions={mapMenu} />
  ) : (
    <SessionViewBar
      label={
        <>
          <MapIcon className="size-4 shrink-0" />
          <span className="truncate">
            {mapDetached ? t("player.mapElsewhere") : t("player.mapHidden")}
          </span>
        </>
      }
    >
      {!mapDetached && (
        <Button size="sm" variant="outline" className="h-7" onClick={() => setShowMap(true)}>
          {t("player.showMapShort")}
        </Button>
      )}
      {mapMenu}
    </SessionViewBar>
  );
  const openFreeRoll = () =>
    setRollSpec({
      label: t("player.roll.free"),
      kind: "carac",
      bonus: 0,
      pool: { count: 1, die: "d20" },
      free: true,
    } satisfies FreeRollSpec);
  const rollSheet = (
    <RollSheet
      spec={rollSpec}
      participant={myParticipant}
      wide={wide}
      ownDice={ownDice}
      onOwnDiceChange={setOwnDice}
      history={rollHistory}
      onRolled={(record) => {
        const next = [{ ...record, at: Date.now() }, ...rollHistory].slice(
          0,
          PARTICIPANT_ROLLS_KEPT,
        );
        setRollHistory(next);
        onParticipantStateChange({
          rolls: next.map(({ label, total, detail, at }) => ({
            label: label.slice(0, 160),
            total: Math.round(total),
            detail: detail.slice(0, 300),
            at: at ?? Date.now(),
          })),
        });
        // A concentration save failed: the spell ends at once.
        if (record.concentration && record.dc !== undefined && record.total < record.dc) {
          onParticipantStateChange({ concentration: null });
          toast(t("player.concentrating.broken"));
        }
        // The GM's combat setup reads it for the next fight.
        if (record.kind === "initiative")
          onParticipantStateChange({ initiativeRoll: record.total });
        // A hit die or Second Wind: at least 1 HP back, never above the maximum.
        if (record.heal)
          setHitPoints(Math.min(maxHitPoints, Math.max(0, hitPoints) + Math.max(1, record.total)));
        // Défense patiente: temporary HP don't add up, the higher pool stays.
        if (record.tempHp) setTemp(Math.max(temp, record.total));
      }}
      onOpen={setRollSpec}
      onClose={() => setRollSpec(null)}
    />
  );

  // What the character's system brings; the layouts below arrange it.
  const layout = ({
    sheetHeader,
    sheetTabs: systemTabs,
    notesInSheet,
    me,
    spells,
    bag,
    phoneStat,
    banner: concentrationBanner,
    dialogs: castDialog,
  }: PlayerSessionBlocks) => {
    // --- Computer ----------------------------------------------------------------
    const sheetTabs: SheetTab<SheetTabId>[] = notesInSheet
      ? systemTabs
      : [
          ...systemTabs,
          {
            id: "notes",
            label: t("player.tabs.questsNotes"),
            content: (
              <>
                <QuestList campaignId={session.campaignId} reader={questReader} />
                {notes}
              </>
            ),
          },
        ];
    const column = (className?: string) => (
      <SheetColumn
        className={className}
        accent={myCharacter.color}
        header={sheetHeader}
        tabs={sheetTabs}
        footer={
          turn &&
          (turn.mine ? (
            <EndTurnButton onEndTurn={onEndTurn} />
          ) : (
            <p className="text-muted-foreground text-center text-sm">{t("player.turn.waiting")}</p>
          ))
        }
      />
    );

    if (pane === "outils") {
      return (
        <SessionPaneFrame className="mx-auto max-w-3xl">
          {column("h-full")}
          {rollSheet}
          {castDialog}
          {companionDialog}
        </SessionPaneFrame>
      );
    }

    if (wide) {
      return (
        <div
          id="session-view"
          className="grid h-full min-h-0 gap-3 px-3 pt-1 pb-3"
          style={{ gridTemplateColumns: sheetShown ? "minmax(0,1fr) 24rem" : "minmax(0,1fr)" }}
        >
          <div id="session-left" className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
            <div className="relative min-h-0 [&>#session-stage]:h-full">
              {mapOrBar}
              {/* The handout shown: a card over the map, to open it again. */}
              {session.shownDocument && (
                <div className="absolute bottom-3 left-3 z-10 w-72">
                  <ShownDocumentCard shown={session.shownDocument} />
                </div>
              )}
              {/* Above the combat bar: the dice, always within reach. */}
              <button
                type="button"
                onClick={openFreeRoll}
                aria-label={t("player.rollDice")}
                className="absolute right-4 bottom-20 z-10 grid size-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-black/20"
                style={{ backgroundColor: myCharacter.color ?? "var(--primary)" }}
              >
                <Dice5Icon className="size-6" />
              </button>
            </div>
            {/* Alone at the table: no empty band (and no scroll) under the map. */}
            {others.length > 0 && party(mapShown ? "strip" : "column")}
          </div>
          {sheetShown && column()}
          {rollSheet}
          {castDialog}
          {companionDialog}
        </div>
      );
    }

    // --- Phone ---------------------------------------------------------------------
    const block = (content: ReactNode) => <div className="flex flex-col gap-3">{content}</div>;
    const phoneTabs: PhoneTab<PhoneTabId>[] = [
      {
        id: "jeu",
        label: t("player.tabs.game"),
        icon: CastleIcon,
        content: block(
          <>
            {turn && (
              <TurnBanner
                turn={turn}
                combatantsById={combatantsById}
                characterName={myCharacter.name.split(" ")[0]}
              />
            )}
            {turn?.mine && <EndTurnButton onEndTurn={onEndTurn} />}
            {mapShown ? (
              <MapCard
                map={<PlayerStage {...stageProps} actions={mapMenu} compact />}
                fullMap={<PlayerStage {...stageProps} />}
              />
            ) : (
              mapOrBar
            )}
            {/* The party under the map, as on a wide screen. */}
            {others.length > 0 && party("strip")}
            <ShownDocumentCard shown={session.shownDocument} />
          </>,
        ),
      },
      {
        id: "moi",
        label: t("player.tabs.me"),
        icon: SwordsIcon,
        dot: !!turn?.mine,
        content: me,
      },
      ...(spells
        ? [
            {
              id: "sorts" as const,
              label: t("sheet.tabs.spells"),
              icon: SparklesIcon,
              content: spells,
            },
          ]
        : []),
      ...(bag
        ? [{ id: "sac" as const, label: t("sheet.tabs.bag"), icon: BackpackIcon, content: bag }]
        : []),
      // As on a computer: the quests and the notes together. The party is in « Jeu ».
      {
        id: "notes",
        label: t("player.tabs.questsNotes"),
        icon: NotebookPenIcon,
        content: block(
          <>
            <QuestList campaignId={session.campaignId} reader={questReader} />
            {notes}
          </>,
        ),
      },
    ];

    return (
      <>
        <PhoneLayout
          tabs={phoneTabs}
          active={phoneTab}
          onActiveChange={setPhoneTab}
          header={
            // On « Moi » the HP are in the screen: the bar shows the fight instead.
            phoneTab === "moi" && turn ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-semibold">
                  {t("player.turn.round", { round: turn.combat.round })} ·{" "}
                  {turn.mine ? (
                    <span className="text-amber-300">{t("player.turn.yoursShort")}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("player.turn.playing", { name: turn.active?.name ?? "" })}
                    </span>
                  )}
                </div>
                <OrderDots combat={turn.combat} combatantsById={combatantsById} />
                {concentrationBanner}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{myCharacter.name}</span>
                  <span className="font-bold tabular-nums">{hitPoints}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    / {maxHitPoints} {t("player.hp")}
                  </span>
                  <TempHpButton temp={temp} onTemp={setTemp} short />
                  {phoneStat}
                </div>
                <HpBar current={hitPoints} max={maxHitPoints} temp={temp} className="h-1.5" />
                {concentrationBanner}
              </div>
            )
          }
          onDice={openFreeRoll}
          accent={myCharacter.color}
        />
        {rollSheet}
        {castDialog}
        {companionDialog}
      </>
    );
  };

  const { PlayerPanel } = screensOf(myCharacter);
  return (
    <PlayerPanel
      session={session}
      combatants={combatants}
      myParticipant={myParticipant}
      myCharacter={myCharacter}
      conditionsEnabled={conditionsEnabled}
      hitPoints={hitPoints}
      maxHitPoints={maxHitPoints}
      temp={temp}
      setHitPoints={setHitPoints}
      setTemp={setTemp}
      turn={turn}
      onRoll={(spec) => setRollSpec(spec as RollSpec)}
      onNotesChange={onNotesChange}
      onCharacterItemsChange={onCharacterItemsChange}
      onParticipantStateChange={onParticipantStateChange}
      onCashInXp={onCashInXp}
      onApplyLevel={onApplyLevel}
      onEndTurn={onEndTurn}
      onMyCombatantChange={onMyCombatantChange}
      onCompanionCombatantHp={onCompanionCombatantHp}
      onCompanionJoinCombat={onCompanionJoinCombat}
      onRemoveCompanionCombatant={onRemoveCompanionCombatant}
    >
      {layout}
    </PlayerPanel>
  );
}
