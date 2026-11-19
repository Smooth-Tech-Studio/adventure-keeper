import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  type AdventureEnemy,
  type AdventureParticipant,
  type AdventureParticipantLiveUpdate,
  type AdventureParticipantPlayerUpdate,
  type Companion,
  type LiveSession,
  type SessionCombat,
} from "@adventure-keeper/schemas";
import { getMonster } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailSkeleton } from "@/components/ui/page-loading";
import type { CombatSetupResult } from "@/components/session/combat-setup-dialog";
import { PreviouslyDialog } from "@/components/session/previously-dialog";
import { RealtimeReconnecting } from "@/components/session/realtime-status";
import { GmSessionView } from "@/components/session/gm-session-view";
import { PlayerSessionView } from "@/components/session/player-session-view";
import { HandoutDialog } from "@/components/session/handout-dialog";
import { LootOfferPrompt } from "@/components/session/loot-offer-prompt";
import { PlayerStage } from "@/components/session/player-stage";
import {
  FullscreenButton,
  MainViewClosedBanner,
  SessionPaneFrame,
} from "@/components/session/session-pane";
import { companionRefId } from "@/systems/dnd2024/lib/companions";
import { d20 } from "@/lib/dice";
import { addEnemy, setLocationHidden } from "@/lib/adventures";
import { enemyFormToInput, type EnemyFormValues } from "@/components/adventure/enemy-form";
import {
  setCharacterExperience,
  updateCharacterItems,
  type CharacterItemsPatch,
  type WithId,
} from "@/lib/collections";
import {
  joinLiveSession,
  leaveLiveSession,
  persistRoomParticipants,
  persistRoomState,
  recordDefeated,
  setSessionClock,
  setSessionLocation,
} from "@/lib/sessions";
import { nextTurn, withAdded, withRemoved } from "@/lib/combat-order";
import { freeSpot, type MapPoint } from "@/lib/map-tokens";
import { run } from "@/lib/run";
import { isSessionPane, sessionPath, type SessionPane } from "@/lib/session-panes";
import { STEPPER_WRITE_MS } from "@/lib/write-buffer";
import { roomParticipantsSnapshot } from "@/lib/realtime/participants";
import { systemOf } from "@/systems";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useBufferedWrites } from "@/hooks/use-buffered-writes";
import { useLiveSessionData } from "@/hooks/use-live-session-data";
import { SessionActionsProvider, type SessionActions } from "@/hooks/use-session-actions";
import { useSessionChromePublish } from "@/hooks/use-session-chrome-publish";
import { useSessionTabs } from "@/hooks/use-session-tabs";

export function GameSessionPage() {
  const {
    id: campaignId,
    adventureId,
    sessionId,
    pane: paneParam,
  } = useParams<{ id: string; adventureId: string; sessionId: string; pane: string }>();
  const { t } = useTranslation(["session", "common"]);
  // A single block opened in its own tab: no navbar control, and it doesn't
  // join the session on its own (the main view does).
  const pane = paneParam && isSessionPane(paneParam) ? paneParam : undefined;
  const { user } = useAuth();
  // The other tabs of this session in this browser: the main view leaves out
  // what's open elsewhere, a detached tab knows when the main view is gone.
  const tabs = useSessionTabs(
    sessionId && user ? `${sessionId}:${user.uid}` : undefined,
    pane ?? "main",
  );
  const detached = useMemo(
    () =>
      pane
        ? undefined
        : new Set([...tabs.others].filter((view): view is SessionPane => view !== "main")),
    [pane, tabs.others],
  );
  const { hasOpenTabs } = tabs;
  const navigate = useNavigate();

  const campaignPath = `/campaigns/${campaignId}`;
  const adventurePath = `/campaigns/${campaignId}/adventures/${adventureId}`;

  const {
    campaign,
    adventure,
    locations,
    enemies,
    npcs,
    session,
    participants: liveParticipants,
    combatants: liveCombatants,
    charactersById,
    missingCharacterIds,
    myParticipant,
    myCombatant,
    myCharacter,
    currentReveal,
    liveStore,
    realtime,
  } = useLiveSessionData(campaignId, adventureId, sessionId, user?.uid);
  // Combatants and combat are written here: Firestore, or the realtime room.
  const store = () => {
    if (!liveStore) throw new Error("live session not loaded");
    return liveStore;
  };
  // GM's HP +/−: shown at once, written once the clicks stop — "−1" five times
  // is one write, not five (each one re-read by every client). Through a
  // realtime room, each click goes out at once: a message costs nothing.
  const hitPoints = useBufferedWrites<number>(
    (combatantId, value) => {
      if (!campaignId || !adventureId || !sessionId) return;
      run(() =>
        store().updateCombatant(combatantId, {
          currentHitPoints: value,
        }),
      );
    },
    { delay: realtime ? 0 : STEPPER_WRITE_MS },
  );
  const combatants = useMemo(
    () =>
      liveCombatants.map((c) =>
        c.id in hitPoints.values ? { ...c, currentHitPoints: hitPoints.values[c.id] } : c,
      ),
    [liveCombatants, hitPoints.values],
  );
  // Through a room that holds the characters' play state, their −/+ goes out
  // at each click too (an older server leaves them in Firestore: buffered).
  const participantsInRoom = !!realtime?.state.participants;
  // The GM's −/+ on a character (party cards, combat list): same buffering, on
  // the participant doc. Keys are `hp:<characterId>` / `temp:<characterId>`.
  const vitals = useBufferedWrites<number>(
    (key, value) => {
      if (!campaignId || !adventureId) return;
      const [field, characterId] = key.split(":");
      const before = liveParticipants.find((p) => p.characterId === characterId);
      const patch: AdventureParticipantLiveUpdate =
        field === "temp" ? { temporaryHitPoints: value } : { currentHitPoints: value };
      // Healed back on their feet: the death-save tally starts over.
      if (field === "hp" && value > 0 && (before?.currentHitPoints ?? 1) <= 0) {
        patch.deathSaves = { successes: 0, failures: 0 };
      }
      run(() => store().updateParticipant(characterId, patch));
    },
    { delay: participantsInRoom ? 0 : STEPPER_WRITE_MS },
  );
  const participants = useMemo(
    () =>
      liveParticipants.map((p) => {
        const hp = vitals.values[`hp:${p.characterId}`];
        const temp = vitals.values[`temp:${p.characterId}`];
        return hp === undefined && temp === undefined
          ? p
          : {
              ...p,
              ...(hp !== undefined && { currentHitPoints: hp }),
              ...(temp !== undefined && { temporaryHitPoints: temp }),
            };
      }),
    [liveParticipants, vitals.values],
  );
  /** Enemies at 0 HP leaving the fight are remembered for the recap — not fallen allies. */
  function keepDefeated(
    leaving: {
      id: string;
      kind: string;
      name: string;
      currentHitPoints: number;
      ally?: boolean;
    }[],
  ) {
    if (!campaignId || !adventureId || !sessionId) return;
    const fallen = leaving.filter((c) => c.kind === "enemy" && !c.ally && c.currentHitPoints <= 0);
    if (fallen.length > 0) {
      run(() => recordDefeated(campaignId, adventureId, sessionId, fallen));
    }
  }
  const combatantsById = useMemo(
    () => Object.fromEntries(combatants.map((c) => [c.id, c])),
    [combatants],
  );

  // Hidden while the session runs (the navbar's control takes over), shown on
  // the loading and "no longer exists" screens.
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: campaign?.name, to: campaignPath },
    { label: adventure?.title, to: adventurePath },
    { label: t("page.crumb") },
  ]);

  const isGm = !!campaign && campaign.ownerId === user?.uid;
  const isEnded = session && session !== "loading" && session.status === "ended";
  // Through a room, who is here is the room's presence: Firestore only keeps
  // who attended (once per player), not each arrival and departure.
  const hasJoined = (live: WithId<LiveSession>, uid: string) =>
    live.realtime ? live.attendeeUids.includes(uid) : live.connectedUids.includes(uid);
  const isJoined = !!session && session !== "loading" && !!user && hasJoined(session, user.uid);

  // A player who lands here from the campaign "Rejoindre" joins straight away.
  useEffect(() => {
    if (pane) return;
    if (!campaignId || !adventureId || !sessionId || !user || !myParticipant) return;
    if (!session || session === "loading" || session.status === "ended") return;
    if (hasJoined(session, user.uid)) return;
    run(() =>
      joinLiveSession(campaignId, adventureId, sessionId, user.uid, {
        presence: !session.realtime,
      }),
    );
  }, [pane, campaignId, adventureId, sessionId, user, session, myParticipant]);

  // Leave the session (drop from connectedUids) if a player navigates away or
  // closes the tab without using "Quitter" — but only from the last open tab:
  // closing the main view while the map stays open in another isn't leaving.
  const leaveOnUnmount = useRef(false);
  const presenceInRoom = !!session && session !== "loading" && !!session.realtime;
  useEffect(() => {
    leaveOnUnmount.current = !isGm && isJoined && !isEnded && !!myParticipant && !presenceInRoom;
  }, [isGm, isJoined, isEnded, myParticipant, presenceInRoom]);
  useEffect(() => {
    if (!campaignId || !adventureId || !sessionId || !user) return;
    const leave = () => {
      if (leaveOnUnmount.current && !hasOpenTabs()) {
        leaveLiveSession(campaignId, adventureId, sessionId, user.uid).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [campaignId, adventureId, sessionId, user, hasOpenTabs]);

  // GM: once the session is ended, go back to the adventure page.
  useEffect(() => {
    if (isEnded && isGm && !pane) navigate(adventurePath, { replace: true });
  }, [isEnded, isGm, pane, navigate, adventurePath]);

  const clearLeaveOnUnmount = useCallback(() => {
    leaveOnUnmount.current = false;
  }, []);
  useSessionChromePublish({
    campaignId,
    adventureId,
    sessionId,
    userId: user?.uid,
    campaign,
    session: pane ? null : session,
    onBeforeLeave: clearLeaveOnUnmount,
    roomUids: realtime?.uids,
    // Played through a realtime server: its room's state goes back to
    // Firestore before the session ends, for the next one and the chronicle —
    // the characters' play state too.
    beforeEnd:
      realtime && campaign?.ownerId === user?.uid
        ? async () => {
            await persistRoomState(campaignId!, adventureId!, sessionId!, realtime.state);
            await persistRoomParticipants(
              campaignId!,
              adventureId!,
              roomParticipantsSnapshot(realtime.state.participants, liveParticipants),
            );
          }
        : undefined,
  });

  if (!user || !campaignId || !adventureId || !sessionId) return null;
  // A detached tab whose main view is gone offers to become it — except the
  // projected map: on the TV nobody's there to click, the map just goes on.
  // A player's too: the main view may be on another device (their phone),
  // which this browser's tabs can't see.
  const mainClosed = !!pane && pane !== "carte" && tabs.settled && !tabs.others.has("main");
  const withBanner = (view: ReactNode) => (
    <>
      {view}
      {!pane && (
        <PreviouslyDialog campaignId={campaignId} adventureId={adventureId} sessionId={sessionId} />
      )}
      {mainClosed && (
        <MainViewClosedBanner
          onShowMain={() => navigate(sessionPath(campaignId, adventureId, sessionId))}
        />
      )}
      {realtime && realtime.status !== "open" && <RealtimeReconnecting />}
    </>
  );
  if (paneParam && !pane) {
    return <Navigate to={sessionPath(campaignId, adventureId, sessionId)} replace />;
  }
  if (session === "loading" || !campaign || !adventure) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }
  if (!session) {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">{t("page.gone")}</p>
      </PageContainer>
    );
  }

  const ended = session.status === "ended";
  const joined = hasJoined(session, user.uid);

  // A pane tab just says so: on a TV, nobody is there to click a dialog.
  if (ended && pane) {
    return (
      <PageContainer>
        <p className="text-muted-foreground text-sm">{t("page.ended")}</p>
      </PageContainer>
    );
  }
  // The GM ended the session while a player was in it.
  if (ended && !isGm) {
    return (
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("page.endedTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t("page.endedByGm")}</p>
          <DialogFooter>
            <Button onClick={() => navigate(campaignPath, { replace: true })}>
              {t("page.backToCampaign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  if (ended) {
    return (
      <PageContainer>
        <p className="text-muted-foreground text-sm">{t("page.ended")}</p>
      </PageContainer>
    );
  }

  // --- Combat handlers -------------------------------------------------------
  const writeHp = (id: string, value: number) =>
    run(() => store().updateCombatant(id, { currentHitPoints: value }));

  // --- XP handlers ---------------------------------------------------------
  // The character sheet is live (subscribeCharacter), so a write to it — XP,
  // level, equipment — flows back into `myCharacter` on its own.

  /** GM awards XP to a participant (queued as pendingXp until the player cashes it in). */
  const awardXp = (characterId: string, delta: number) => {
    const target = participants.find((p) => p.characterId === characterId);
    run(
      () =>
        store().updateParticipant(characterId, {
          pendingXp: Math.max(0, (target?.pendingXp ?? 0) + delta),
        }),
      "Action impossible.",
    );
  };

  /**
   * GM sets a participant's conditions / exhaustion (players see them
   * read-only), or gives / takes back their Heroic Inspiration.
   */
  const setParticipantState = (
    characterId: string,
    patch: Pick<AdventureParticipantLiveUpdate, "conditions" | "exhaustion" | "heroicInspiration">,
  ) => {
    run(() => store().updateParticipant(characterId, patch), "Action impossible.");
  };

  /** Player folds the GM's pending XP into their character sheet. */
  const cashInXp = async () => {
    if (!myParticipant || !myCharacter) return;
    const gain = myParticipant.pendingXp ?? 0;
    const earned = systemOf(myCharacter).experienceOf(myCharacter);
    if (gain <= 0 || earned === null) return;
    try {
      await setCharacterExperience(myCharacter.id, earned + gain);
      await store().updateParticipant(myParticipant.characterId, { pendingXp: 0 });
    } catch (error) {
      console.error(error);
      toast.error(t("page.cashFailed"));
    }
  };

  /** Player opens the guided level-up, coming back to the session afterwards. */
  const applyLevel = () => {
    if (!myCharacter) return;
    const back = encodeURIComponent(window.location.pathname);
    navigate(`/characters/${myCharacter.id}/level-up?returnTo=${back}`);
  };

  async function addParticipantCombatant(
    participant: WithId<AdventureParticipant>,
    initiative?: number,
    onMap?: boolean,
    at?: MapPoint,
  ) {
    const character = charactersById[participant.characterId];
    const maxHp = character?.maxHitPoints ?? participant.currentHitPoints ?? 10;
    const stats = character ? systemOf(character).combatStats(character) : undefined;
    return store().addCombatant({
      kind: "participant",
      refId: participant.characterId,
      name: participant.characterName,
      color: character?.color,
      maxHitPoints: maxHp,
      currentHitPoints: participant.currentHitPoints ?? maxHp,
      armorClass: stats?.armorClass ?? 10,
      playerId: participant.playerId,
      initiative,
      onMap,
      ...at,
      size: stats?.size,
    });
  }

  async function addEnemyCombatant(
    enemy: WithId<AdventureEnemy>,
    initiative?: number,
    label?: string,
    onMap?: boolean,
    ally?: { color?: string },
  ) {
    return store().addCombatant({
      kind: "enemy",
      refId: enemy.id,
      name: label ?? enemy.name,
      // An allied NPC keeps its own colour; an ally without one is teal (see `combatantColor`).
      color: ally ? ally.color : enemy.color,
      ...(ally ? { ally: true } : {}),
      maxHitPoints: enemy.maxHitPoints,
      currentHitPoints: enemy.maxHitPoints,
      armorClass: enemy.armorClass,
      initiative,
      onMap,
      size: enemy.size,
    });
  }

  /**
   * A character's companion (its familiar) as a combatant of its own, owned by
   * its player — on the map, beside its character's token when there is one.
   */
  async function addCompanionCombatant(
    participant: WithId<AdventureParticipant>,
    companion: Companion,
    initiative?: number,
    onMap?: boolean,
    /** Where to drop it, when the caller already knows (a combat being set up). */
    at?: MapPoint,
  ) {
    const owner = combatants.find(
      (c) => c.kind === "participant" && c.refId === participant.characterId && c.onMap,
    );
    const spot =
      at ??
      (onMap && owner
        ? freeSpot(
            combatants.filter((c) => c.onMap),
            { x: owner.x, y: owner.y },
          )
        : undefined);
    return store().addCombatant({
      ...spot,
      kind: "companion",
      refId: companionRefId(participant.characterId, companion.id),
      name: companion.name,
      color: charactersById[participant.characterId]?.color,
      maxHitPoints: companion.maxHitPoints,
      currentHitPoints: companion.currentHitPoints,
      armorClass: companion.armorClass,
      playerId: participant.playerId,
      initiative,
      onMap,
      size: (companion.monsterId && getMonster(companion.monsterId)?.size) || "tiny",
    });
  }

  /** Persist a brand-new enemy type from the combat-setup dialog. */
  async function createEnemyType(values: EnemyFormValues): Promise<WithId<AdventureEnemy>> {
    const input = enemyFormToInput(values);
    const id = await addEnemy(campaignId!, adventureId!, input);
    // The real doc streams in via the enemies subscription a moment later; this
    // stand-in carries everything the combat-setup / combatant code reads.
    return {
      id,
      ...input,
      speed: input.speed ?? 30,
      attacks: input.attacks ?? [],
    } as unknown as WithId<AdventureEnemy>;
  }

  async function createCombat(entries: CombatSetupResult) {
    try {
      const rows: { id: string; initiative: number }[] = [];
      // Tokens dropped one after another: each new one takes a free place, and
      // a familiar lands beside its character.
      const placed: MapPoint[] = combatants.filter((c) => c.onMap).map(({ x, y }) => ({ x, y }));
      const characterAt = new Map<string, MapPoint>();
      for (const { participant, initiative } of entries.participants) {
        const existing = combatants.find(
          (c) => c.kind === "participant" && c.refId === participant.characterId,
        );
        if (existing) {
          // Keep a token that's already placed; drop one on the map otherwise.
          await store().updateCombatant(existing.id, {
            initiative,
            ...(existing.onMap ? {} : { onMap: true }),
          });
          characterAt.set(participant.characterId, { x: existing.x, y: existing.y });
          rows.push({ id: existing.id, initiative });
        } else {
          const at = freeSpot(placed);
          placed.push(at);
          characterAt.set(participant.characterId, at);
          const id = await addParticipantCombatant(participant, initiative, true, at);
          rows.push({ id, initiative });
        }
      }
      for (const { participant, companion, initiative } of entries.companions) {
        const refId = companionRefId(participant.characterId, companion.id);
        const existing = combatants.find((c) => c.kind === "companion" && c.refId === refId);
        if (existing) {
          await store().updateCombatant(existing.id, {
            initiative,
            ...(existing.onMap ? {} : { onMap: true }),
          });
          rows.push({ id: existing.id, initiative });
        } else {
          const at = freeSpot(placed, characterAt.get(participant.characterId));
          placed.push(at);
          const id = await addCompanionCombatant(participant, companion, initiative, true, at);
          rows.push({ id, initiative });
        }
      }
      for (const { enemy, label, initiative, ally, color } of entries.enemies) {
        // Enemies always get a token dropped on the map automatically.
        const id = await addEnemyCombatant(
          enemy,
          initiative,
          label,
          true,
          ally ? { color } : undefined,
        );
        rows.push({ id, initiative });
      }
      rows.sort((a, b) => b.initiative - a.initiative);
      // The players' rolls are spent: the next fight starts from a clean slate.
      await Promise.all(
        entries.participants
          .filter(({ participant }) => participant.initiativeRoll != null)
          .map(({ participant }) =>
            store().updateParticipant(participant.characterId, {
              initiativeRoll: null,
            }),
          ),
      );
      await store().setCombat({ round: 1, turnIndex: 0, order: rows.map((r) => r.id) });
    } catch (error) {
      console.error(error);
      toast.error(t("page.combatFailed"));
    }
  }

  /** Bring new enemies into the running combat, slotted into the initiative order. */
  async function addEnemiesToCombat(running: SessionCombat, entries: CombatSetupResult) {
    try {
      const rows: { id: string; initiative: number }[] = [];
      for (const { enemy, label, initiative, ally, color } of entries.enemies) {
        const id = await addEnemyCombatant(
          enemy,
          initiative,
          label,
          true,
          ally ? { color } : undefined,
        );
        rows.push({ id, initiative });
      }
      const scores = new Map(
        combatants.flatMap((c) =>
          c.initiative !== undefined ? [[c.id, c.initiative] as const] : [],
        ),
      );
      await store().setCombat(withAdded(running, rows, scores));
    } catch (error) {
      console.error(error);
      toast.error(t("page.enemiesFailed"));
    }
  }

  const combat = session.combat;

  // --- Fog of war (hidden locations) -------------------------------------
  const revealLocationId = session.currentLocationId;
  const onCommitFog = (mask: string, cols: number, rows: number) => {
    if (revealLocationId) run(() => store().setFog(revealLocationId, { mask, cols, rows }));
  };

  // The whole GM write surface, bound to this session — provided via context so
  // the session components don't thread ~20 `on*` props through each other.
  const gmActions: SessionActions = {
    onLocation: (locationId) =>
      run(
        () =>
          setSessionLocation(
            campaignId,
            adventureId,
            sessionId,
            locationId ? (locations.find((l) => l.id === locationId) ?? null) : null,
          ),
        "Action impossible.",
      ),
    onSetLocationHidden: (locationId, hidden) =>
      run(
        () => setLocationHidden(campaignId, adventureId, locationId, hidden),
        "Action impossible.",
      ),
    onClock: (value) =>
      run(() => setSessionClock(campaignId, adventureId, sessionId, value), "Action impossible."),
    onCombatantHitPoints: hitPoints.set,
    onParticipantVitals: (characterId, patch) => {
      if (patch.temporaryHitPoints !== undefined) {
        vitals.set(`temp:${characterId}`, patch.temporaryHitPoints);
      }
      if (patch.currentHitPoints !== undefined) {
        vitals.set(`hp:${characterId}`, patch.currentHitPoints);
        // Its token carries the HP too (the map, the turn order read it).
        const token = combatants.find((c) => c.kind === "participant" && c.refId === characterId);
        if (token) hitPoints.set(token.id, patch.currentHitPoints);
      }
    },
    onToggleCombatantMap: (id, onMap) => run(() => store().updateCombatant(id, { onMap })),
    onPlaceParticipant: (participant) => {
      const existing = combatants.find(
        (c) => c.kind === "participant" && c.refId === participant.characterId,
      );
      // Back where it was, or on a free spot (not on top of another token).
      if (existing) run(() => store().updateCombatant(existing.id, { onMap: true }));
      else
        run(() =>
          addParticipantCombatant(
            participant,
            undefined,
            true,
            freeSpot(combatants.filter((c) => c.onMap)),
          ),
        );
    },
    onMoveToken: (id, x, y) => run(() => store().updateCombatant(id, { x, y })),
    onSetCombatantConditions: (id, conditions) =>
      run(() => store().updateCombatant(id, { conditions })),
    onRemoveCombatant: (id) => {
      keepDefeated(combatants.filter((c) => c.id === id));
      run(() => store().removeCombatant(id));
      // Drop it from the initiative order too, or its stale id would break the turn bar.
      if (combat) {
        run(() => store().setCombat(withRemoved(combat, id)));
      }
    },
    onAddParticipantCombatant: (p) => run(() => addParticipantCombatant(p), "Ajout impossible."),
    onAddEnemyCombatant: (e) => {
      const same = combatants.filter((c) => c.kind === "enemy" && c.refId === e.id).length;
      run(
        () => addEnemyCombatant(e, undefined, same > 0 ? `${e.name} ${same + 1}` : e.name),
        "Ajout impossible.",
      );
    },
    onCreateCombat: createCombat,
    onAddEnemiesToCombat: (entries) => {
      if (combat) void addEnemiesToCombat(combat, entries);
    },
    onCreateEnemy: createEnemyType,
    onNext: () => {
      if (combat) run(() => store().setCombat(nextTurn(combat)));
    },
    onEndCombat: () => {
      keepDefeated(combatants);
      run(() => store().setCombat(null));
    },
    onDestroyCombatant: (id) => {
      keepDefeated(combatants.filter((c) => c.id === id));
      run(() => store().removeCombatant(id));
      if (combat) {
        run(() => store().setCombat(withRemoved(combat, id)));
      }
    },
    onAwardXp: awardXp,
    onSetParticipantState: setParticipantState,
    onCommitFog,
  };

  if (isGm) {
    // The GM's projection: the map exactly as the players see it.
    if (pane === "carte") {
      return (
        <SessionPaneFrame>
          <PlayerStage
            session={session}
            locations={locations}
            combatants={combatants}
            combatantsById={combatantsById}
            reveal={currentReveal}
            className="max-lg:aspect-auto"
            actions={<FullscreenButton />}
          />
        </SessionPaneFrame>
      );
    }
    return withBanner(
      <SessionActionsProvider value={gmActions}>
        <GmSessionView
          session={session}
          locations={locations}
          enemies={enemies}
          npcs={npcs}
          participants={participants}
          combatants={combatants}
          combatantsById={combatantsById}
          charactersById={charactersById}
          conditionsEnabled={adventure.conditionsEnabled ?? false}
          reveal={currentReveal}
          pane={pane}
          detached={detached}
        />
      </SessionActionsProvider>,
    );
  }

  if ((joined || pane) && myParticipant && myCharacter) {
    const current =
      myCombatant?.currentHitPoints ?? myParticipant.currentHitPoints ?? myCharacter.maxHitPoints;
    const max = myCombatant?.maxHitPoints ?? myCharacter.maxHitPoints;
    return withBanner(
      <>
        {!pane && <HandoutDialog shown={session.shownDocument} />}
        {!pane && (
          <LootOfferPrompt session={session} uid={myParticipant.playerId} character={myCharacter} />
        )}
        <PlayerSessionView
          session={session}
          locations={locations}
          participants={participants}
          combatants={combatants}
          combatantsById={combatantsById}
          charactersById={charactersById}
          myParticipant={myParticipant}
          myCharacter={myCharacter}
          currentHitPoints={current}
          maxHitPoints={max}
          reveal={currentReveal}
          onHitPointsChange={(value) => {
            // Already held back by the player's own buffer (PlayerSessionView).
            if (myCombatant) writeHp(myCombatant.id, value);
            const wasDown = current <= 0;
            const patch: AdventureParticipantPlayerUpdate = { currentHitPoints: value };
            // Back on your feet: clear the death-save tally.
            if (wasDown && value > 0) patch.deathSaves = { successes: 0, failures: 0 };
            // Dropping to 0 ends concentration.
            if (value <= 0 && !wasDown) patch.concentration = null;
            run(() => store().updateParticipant(myParticipant.characterId, patch));
          }}
          onNotesChange={(value) =>
            run(() =>
              store().updateParticipant(myParticipant.characterId, {
                notes: value,
              }),
            )
          }
          onCharacterItemsChange={(patch: CharacterItemsPatch) =>
            run(() => updateCharacterItems(myCharacter.id, patch), "Modification impossible.")
          }
          onParticipantStateChange={(patch) =>
            run(
              () => store().updateParticipant(myParticipant.characterId, patch),
              "Modification impossible.",
            )
          }
          onCashInXp={cashInXp}
          instantWrites={participantsInRoom}
          conditionsEnabled={adventure.conditionsEnabled ?? false}
          onApplyLevel={applyLevel}
          onEndTurn={() => {
            if (combat) run(() => store().setCombat(nextTurn(combat)));
          }}
          onMyCombatantChange={(patch) => {
            if (myCombatant) run(() => store().updateCombatant(myCombatant.id, patch));
          }}
          onCompanionCombatantHp={writeHp}
          onCompanionJoinCombat={async (companion) => {
            if (!combat) return undefined;
            // Its own initiative: d20 + its Dexterity.
            const initiative = d20() + companion.dexModifier;
            try {
              const refId = companionRefId(myParticipant.characterId, companion.id);
              const existing = combatants.find((c) => c.kind === "companion" && c.refId === refId);
              const id = existing
                ? existing.id
                : await addCompanionCombatant(myParticipant, companion, initiative, true);
              if (existing) await store().updateCombatant(id, { initiative });
              const scores = new Map(
                combatants.flatMap((c) =>
                  c.initiative !== undefined ? [[c.id, c.initiative] as const] : [],
                ),
              );
              await store().setCombat(withAdded(combat, [{ id, initiative }], scores));
              return initiative;
            } catch (error) {
              console.error(error);
              toast.error(t("page.combatFailed"));
              return undefined;
            }
          }}
          onRemoveCompanionCombatant={(id) => {
            run(() => store().removeCombatant(id));
            if (combat) run(() => store().setCombat(withRemoved(combat, id)));
          }}
          pane={pane}
          detached={detached}
        />
      </>,
    );
  }

  return (
    <PageContainer>
      {!joined && !pane && myParticipant ? (
        <p className="text-muted-foreground text-sm">{t("page.connecting")}</p>
      ) : !myParticipant ? (
        <p className="text-muted-foreground text-sm">{t("page.notAdded")}</p>
      ) : missingCharacterIds.has(myParticipant.characterId) ? (
        // The participant exists but its sheet does not resolve: deleted, or
        // still a draft. Saying "chargement" here leaves the player watching a
        // spinner that will never resolve.
        <p className="text-muted-foreground text-sm">{t("page.characterGone")}</p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("page.loadingCharacter")}</p>
      )}
    </PageContainer>
  );
}
