import { useEffect, useMemo, useState } from "react";
import type {
  Adventure,
  AdventureEnemy,
  AdventureNpc,
  AdventureLocation,
  AdventureParticipant,
  Campaign,
  ReadyCharacter,
  LiveSession,
  SessionCombatant,
  SessionMapReveal,
} from "@adventure-keeper/schemas";

import {
  listEnemies,
  listNpcs,
  subscribeAdventure,
  subscribeLocations,
  subscribeParticipants,
} from "@/lib/adventures";
import {
  getCampaign,
  readyCharacterOrNull,
  subscribeCharacter,
  withFreshDerived,
  type WithId,
} from "@/lib/collections";
import { run } from "@/lib/run";
import { firestoreLiveStore, roomLiveStore, type LiveStore } from "@/lib/live-store";
import { withRoomParticipants } from "@/lib/realtime/participants";
import type { RoomSnapshot } from "@/lib/realtime/room-client";
import { useLiveRoom } from "@/hooks/use-live-room";
import { subscribeCombatants, subscribeLiveSession, subscribeMapReveal } from "@/lib/sessions";
import { useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { packContentOf } from "@/systems/dnd2024/lib/character-storage";

export interface LiveSessionData {
  campaign: WithId<Campaign> | null;
  adventure: WithId<Adventure> | null;
  locations: WithId<AdventureLocation>[];
  enemies: WithId<AdventureEnemy>[];
  /** The adventure's NPCs — those with a combat profile can fight as allies. */
  npcs: WithId<AdventureNpc>[];
  session: WithId<LiveSession> | null | "loading";
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
  charactersById: Record<string, WithId<ReadyCharacter>>;
  /**
   * Participants whose sheet came back but is unusable — deleted, or back to a
   * draft. Distinct from "not loaded yet", which is simply an absent key.
   */
  missingCharacterIds: Set<string>;
  myParticipant: WithId<AdventureParticipant> | null;
  myCombatant: WithId<SessionCombatant> | null;
  combatantsById: Record<string, WithId<SessionCombatant>>;
  myCharacter: WithId<ReadyCharacter> | null;
  /** Fog-of-war reveal state for the location the GM is currently showing. */
  currentReveal: WithId<SessionMapReveal> | null;
  /** Where the combatants and the combat are written: Firestore, or the realtime room. */
  liveStore: LiveStore | null;
  /** The realtime room as last heard (`null` when the session plays on Firestore). */
  realtime: RoomSnapshot | null;
}

/**
 * The read side of the live session page: the one-shot campaign / locations /
 * enemies load, the realtime subscriptions (adventure / session / participants /
 * combatants) and a live character-sheet listener per participant. The session
 * reads equipment,
 * inventory, AC and attacks straight off `characters/{id}`, so an edit the owner
 * makes in their panel propagates to every viewer.
 */
export function useLiveSessionData(
  campaignId: string | undefined,
  adventureId: string | undefined,
  sessionId: string | undefined,
  userId: string | undefined,
): LiveSessionData {
  const [campaign, setCampaign] = useState<WithId<Campaign> | null>(null);
  const [adventure, setAdventure] = useState<WithId<Adventure> | null>(null);
  const [locations, setLocations] = useState<WithId<AdventureLocation>[]>([]);
  const [enemies, setEnemies] = useState<WithId<AdventureEnemy>[]>([]);
  const [npcs, setNpcs] = useState<WithId<AdventureNpc>[]>([]);
  const [session, setSession] = useState<WithId<LiveSession> | null | "loading">("loading");
  const [participants, setParticipants] = useState<WithId<AdventureParticipant>[]>([]);
  const [combatants, setCombatants] = useState<WithId<SessionCombatant>[]>([]);
  const [charactersById, setCharactersById] = useState<Record<string, WithId<ReadyCharacter>>>({});
  // Participants' own copies of their pack entries (species traits, feats…).
  useRegisterPacks(packContentOf(Object.values(charactersById)));
  const [missingCharacterIds, setMissingCharacterIds] = useState<Set<string>>(new Set());
  const [currentReveal, setCurrentReveal] = useState<WithId<SessionMapReveal> | null>(null);

  useEffect(() => {
    if (!campaignId || !adventureId || !userId) return;
    run(async () => {
      const [c, e, n] = await Promise.all([
        getCampaign(campaignId),
        listEnemies(campaignId, adventureId),
        listNpcs(campaignId, adventureId).catch(() => [] as WithId<AdventureNpc>[]),
      ]);
      setCampaign(c);
      setEnemies(e);
      setNpcs(n);
    });
  }, [campaignId, adventureId, userId]);

  useEffect(() => {
    if (!campaignId || !adventureId) return;
    const unsubAdventure = subscribeAdventure(campaignId, adventureId, setAdventure);
    return unsubAdventure;
  }, [campaignId, adventureId]);

  // Only the GM may read the locations' secrets (description, hidden maps);
  // wait for the campaign so a player never subscribes to them.
  const isGm = campaign !== null && campaign.ownerId === userId;
  const campaignKnown = campaign !== null;
  useEffect(() => {
    if (!campaignId || !adventureId || !campaignKnown) return;
    return subscribeLocations(campaignId, adventureId, setLocations, { gm: isGm });
  }, [campaignId, adventureId, campaignKnown, isGm]);

  useEffect(() => {
    if (!campaignId || !adventureId || !sessionId) return;
    const unsubSession = subscribeLiveSession(campaignId, adventureId, sessionId, setSession);
    const unsubParticipants = subscribeParticipants(campaignId, adventureId, setParticipants);
    return () => {
      unsubSession();
      unsubParticipants();
    };
  }, [campaignId, adventureId, sessionId]);

  // The combatants: from Firestore, unless the session plays through a
  // realtime server — then from its room, and Firestore is not read at all.
  const sessionLoaded = !!session && session !== "loading";
  const realtimeOn = sessionLoaded && !!session.realtime;
  useEffect(() => {
    if (!campaignId || !adventureId || !sessionId || !sessionLoaded || realtimeOn) return;
    return subscribeCombatants(campaignId, adventureId, sessionId, setCombatants);
  }, [campaignId, adventureId, sessionId, sessionLoaded, realtimeOn]);
  const { room, snapshot: realtime } = useLiveRoom(
    campaignId,
    adventureId,
    session,
    isGm,
    participants,
  );
  // Through a room, the characters' play state comes from it, over Firestore's.
  const liveParticipants = useMemo(
    () => withRoomParticipants(participants, realtime?.state.participants),
    [participants, realtime],
  );
  const liveCombatants = useMemo(
    () =>
      realtime
        ? (Object.values(realtime.state.combatants) as WithId<SessionCombatant>[])
        : realtimeOn
          ? []
          : combatants,
    [realtime, realtimeOn, combatants],
  );
  const liveSession = useMemo(
    () =>
      realtime && session && session !== "loading"
        ? { ...session, combat: realtime.state.combat ?? undefined }
        : session,
    [realtime, session],
  );
  const liveStore = useMemo(
    () =>
      !campaignId || !adventureId || !sessionId || !sessionLoaded
        ? null
        : realtimeOn
          ? room &&
            roomLiveStore(room, sessionId, firestoreLiveStore(campaignId, adventureId, sessionId))
          : firestoreLiveStore(campaignId, adventureId, sessionId),
    [campaignId, adventureId, sessionId, sessionLoaded, realtimeOn, room],
  );

  const currentLocationId =
    session && session !== "loading" ? session.currentLocationId : undefined;
  useEffect(() => {
    if (!campaignId || !adventureId || !sessionId || !currentLocationId) {
      setCurrentReveal(null);
      return;
    }
    return subscribeMapReveal(
      campaignId,
      adventureId,
      sessionId,
      currentLocationId,
      setCurrentReveal,
    );
  }, [campaignId, adventureId, sessionId, currentLocationId]);

  // Through a room, the mask comes from it (painted live); the place's
  // snapshot (name, map) stays in Firestore, written once per visit.
  const roomFog = currentLocationId ? realtime?.state.fog[currentLocationId] : undefined;
  const liveReveal = useMemo(
    () => (currentReveal && roomFog ? { ...currentReveal, ...roomFog } : currentReveal),
    [currentReveal, roomFog],
  );

  const myParticipant = useMemo(
    () => liveParticipants.find((p) => p.playerId === userId) ?? null,
    [liveParticipants, userId],
  );
  const myCombatant = useMemo(
    () => liveCombatants.find((c) => c.kind === "participant" && c.playerId === userId) ?? null,
    [liveCombatants, userId],
  );
  const combatantsById = useMemo(
    () => Object.fromEntries(liveCombatants.map((c) => [c.id, c])),
    [liveCombatants],
  );

  // One live sheet listener per participating character. The derived block is
  // refreshed on the way in so a sheet not re-saved since the last rules change
  // still reads right in play.
  const characterIds = useMemo(
    () => [...new Set(participants.map((p) => p.characterId))].sort(),
    [participants],
  );
  const characterIdsKey = characterIds.join(",");
  useEffect(() => {
    if (characterIds.length === 0) {
      setCharactersById({});
      setMissingCharacterIds(new Set());
      return;
    }
    const unsubs = characterIds.map((id) =>
      subscribeCharacter(id, (character) => {
        setCharactersById((prev) => {
          // A draft has no hit points, AC or modifiers, so there is nothing to
          // play with — drop it here, at the boundary, and every session view
          // downstream can take a finished sheet without re-checking.
          const ready = readyCharacterOrNull(character);
          if (!ready) {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          }
          return { ...prev, [id]: withFreshDerived(ready) };
        });
        // The snapshot has spoken, so an absent sheet is now a fact rather
        // than a pending read.
        setMissingCharacterIds((prev) => {
          const absent = readyCharacterOrNull(character) === null;
          if (absent === prev.has(id)) return prev;
          const next = new Set(prev);
          if (absent) next.add(id);
          else next.delete(id);
          return next;
        });
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterIdsKey]);

  const myCharacter = myParticipant ? (charactersById[myParticipant.characterId] ?? null) : null;

  return {
    campaign,
    adventure,
    locations,
    enemies,
    npcs,
    session: liveSession,
    participants: liveParticipants,
    combatants: liveCombatants,
    charactersById,
    missingCharacterIds,
    myParticipant,
    myCombatant,
    combatantsById,
    myCharacter,
    currentReveal: liveReveal,
    liveStore,
    realtime,
  };
}
