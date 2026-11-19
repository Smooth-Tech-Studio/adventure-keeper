import { useEffect, useMemo, useRef, useState } from "react";
import type { AdventureParticipant, LiveSession } from "@adventure-keeper/schemas";
import { toast } from "sonner";

import { auth } from "@/lib/firebase";
import { tr } from "@/i18n";
import type { WithId } from "@/lib/collections";
import { participantsToSave, roomFieldsOf } from "@/lib/realtime/participants";
import { RoomClient, type RoomSnapshot } from "@/lib/realtime/room-client";
import {
  getSessionGm,
  listCombatants,
  listMapReveals,
  persistRoomParticipants,
} from "@/lib/sessions";

/** How often the GM's tab copies the characters' play state back to Firestore. */
const CHECKPOINT_MS = 5 * 60_000;
/** A participant sent to the room and not echoed yet is not sent again before this. */
const TRACK_RETRY_MS = 5_000;

/**
 * The session's room on the self-hosted realtime server, when it was started
 * with one (`session.realtime`): `null` otherwise. The GM joins with the GM
 * key (read from the GM-only doc) and, on a room still empty, seeds it with
 * what Firestore has — the state carried over from the previous session, fog
 * included. It brings each character's play state into the room
 * (`participant.track`), and copies it back to Firestore every few minutes and
 * when the tab goes to the background: if the session is never ended, the
 * sheets are still up to date.
 */
export function useLiveRoom(
  campaignId: string | undefined,
  adventureId: string | undefined,
  session: WithId<LiveSession> | null | "loading",
  isGm: boolean,
  /** The participants as Firestore has them. */
  participants: WithId<AdventureParticipant>[],
): { room: RoomClient | null; snapshot: RoomSnapshot | null } {
  const realtime = session && session !== "loading" ? session.realtime : undefined;
  const sessionId = session && session !== "loading" ? session.id : undefined;
  const combat = session && session !== "loading" ? session.combat : undefined;
  const [gmKey, setGmKey] = useState<string | null | undefined>(undefined);

  // The GM key, for the GM: a player joins with the member key alone.
  useEffect(() => {
    if (!realtime || !campaignId || !adventureId || !sessionId) return;
    if (!isGm) {
      setGmKey(null);
      return;
    }
    let cancelled = false;
    void getSessionGm(campaignId, adventureId, sessionId)
      .then((gm) => !cancelled && setGmKey(gm?.realtimeGmKey ?? null))
      .catch(() => !cancelled && setGmKey(null));
    return () => {
      cancelled = true;
    };
  }, [realtime, campaignId, adventureId, sessionId, isGm]);

  const url = realtime?.url;
  const memberKey = realtime?.memberKey;
  const room = useMemo(() => {
    if (!url || !memberKey || !sessionId || gmKey === undefined) return null;
    return new RoomClient({
      url,
      room: sessionId,
      memberKey,
      gmKey: gmKey ?? undefined,
      getToken: async () => {
        const user = auth.currentUser;
        if (!user) throw new Error("signed out");
        return user.getIdToken();
      },
      onError: (message) => toast.error(tr("session:realtime.refused", { message })),
    });
  }, [url, memberKey, sessionId, gmKey]);

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  useEffect(() => {
    if (!room) {
      setSnapshot(null);
      return;
    }
    const unsubscribe = room.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      room.close();
    };
  }, [room]);

  // An empty room, opened by the GM: carry over what Firestore holds.
  const seedable = !!room && !!snapshot?.gm && snapshot.status === "open";
  useEffect(() => {
    if (!room || !seedable || !campaignId || !adventureId || !sessionId) return;
    const { state } = room.snapshot;
    if (Object.keys(state.combatants).length > 0 || state.combat || Object.keys(state.fog).length)
      return;
    void Promise.all([
      listCombatants(campaignId, adventureId, sessionId),
      listMapReveals(campaignId, adventureId, sessionId),
    ]).then(([combatants, reveals]) => {
      const fog = Object.fromEntries(
        reveals.flatMap(({ id, mask, cols, rows }) =>
          mask && cols && rows ? [[id, { mask, cols, rows }]] : [],
        ),
      );
      if (combatants.length === 0 && !combat && Object.keys(fog).length === 0) return;
      room.send({
        type: "seed",
        combatants: combatants.map(({ createdAt: _c, updatedAt: _u, ...fields }) => fields),
        combat: combat ?? null,
        fog,
      });
    });
    // Once per room: the seed is refused on a room no longer empty anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, seedable]);

  // GM: each character's play state enters the room, as Firestore has it.
  const roomParticipants =
    snapshot?.gm && snapshot.status === "open" ? snapshot.state.participants : undefined;
  const tracked = useRef(new Map<string, number>());
  useEffect(() => {
    if (!room || !roomParticipants) return;
    const now = Date.now();
    for (const participant of participants) {
      if (roomParticipants[participant.characterId]) continue;
      if (now - (tracked.current.get(participant.characterId) ?? 0) < TRACK_RETRY_MS) continue;
      tracked.current.set(participant.characterId, now);
      room.send({
        type: "participant.track",
        characterId: participant.characterId,
        participant: { ...roomFieldsOf(participant), playerId: participant.playerId },
      });
    }
  }, [room, roomParticipants, participants]);

  // GM: the room's play state back to Firestore, now and then.
  const latest = useRef({ roomParticipants, participants });
  useEffect(() => {
    latest.current = { roomParticipants, participants };
  });
  const checkpointOn = !!roomParticipants && !!campaignId && !!adventureId;
  useEffect(() => {
    if (!checkpointOn || !campaignId || !adventureId) return;
    const save = () => {
      const saves = participantsToSave(
        latest.current.roomParticipants,
        latest.current.participants,
      );
      persistRoomParticipants(campaignId, adventureId, saves).catch((error: unknown) =>
        console.warn("participants checkpoint:", error),
      );
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    const timer = window.setInterval(save, CHECKPOINT_MS);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", save);
    };
  }, [checkpointOn, campaignId, adventureId]);

  return { room, snapshot };
}
