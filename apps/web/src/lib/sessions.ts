import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ACTIVE_LIVE_SESSION_STATUSES,
  COLLECTIONS,
  LIVE_SESSION_GM_DOC_ID,
  LIVE_SESSION_PRIVATE_COLLECTION,
  liveSessionGmSchema,
  liveSessionSchema,
  sessionCombatantSchema,
  sessionMapRevealSchema,
  type DefeatedEnemy,
  type LiveSession,
  type LiveSessionGm,
  type LiveSessionStatus,
  type RoomParticipantLive,
  type RoomState,
  type SessionCombat,
  type SessionCombatant,
  type SessionMapReveal,
} from "@adventure-keeper/schemas";

import type { GameTime } from "@/lib/game-time";
import { db } from "@/lib/firebase";
import { revealLocationInCodex } from "@/lib/codex";
import { listAdventures, setAdventureLiveSession, updateAdventure } from "@/lib/adventures";
import type { WithId } from "@adventure-keeper/schemas";
import { parseDoc, toMillis } from "@/lib/firestore";
import { run } from "@/lib/run";

const sessionsCol = (campaignId: string, adventureId: string) =>
  collection(
    db,
    COLLECTIONS.campaigns,
    campaignId,
    COLLECTIONS.adventures,
    adventureId,
    COLLECTIONS.liveSessions,
  );

const sessionDoc = (campaignId: string, adventureId: string, sessionId: string) =>
  doc(sessionsCol(campaignId, adventureId), sessionId);

const sessionGmDoc = (campaignId: string, adventureId: string, sessionId: string) =>
  doc(
    sessionDoc(campaignId, adventureId, sessionId),
    LIVE_SESSION_PRIVATE_COLLECTION,
    LIVE_SESSION_GM_DOC_ID,
  );

const mapRevealsCol = (campaignId: string, adventureId: string, sessionId: string) =>
  collection(sessionDoc(campaignId, adventureId, sessionId), COLLECTIONS.mapReveals);

const mapRevealDoc = (
  campaignId: string,
  adventureId: string,
  sessionId: string,
  locationId: string,
) => doc(mapRevealsCol(campaignId, adventureId, sessionId), locationId);

/** The active (live or paused) session for an adventure, if any. */
export async function getActiveLiveSession(
  campaignId: string,
  adventureId: string,
): Promise<WithId<LiveSession> | null> {
  const snapshot = await getDocs(
    query(
      sessionsCol(campaignId, adventureId),
      where("status", "in", ACTIVE_LIVE_SESSION_STATUSES),
    ),
  );
  const first = snapshot.docs[0];
  return first ? parseDoc<LiveSession>(liveSessionSchema, first) : null;
}

/**
 * Copy a finished session's play state onto a fresh one: the placed combatants,
 * every location's revealed fog, and — remapped onto the new combatant ids — an
 * in-progress combat's initiative order.
 */
async function cloneSessionState(
  campaignId: string,
  adventureId: string,
  fromSessionId: string,
  toSessionId: string,
  fromCombat: SessionCombat | undefined,
): Promise<void> {
  const now = serverTimestamp();

  const combatantsSnap = await getDocs(combatantsCol(campaignId, adventureId, fromSessionId)).catch(
    () => null,
  );
  const idMap = new Map<string, string>();
  if (combatantsSnap) {
    for (const snap of combatantsSnap.docs) {
      const data = snap.data() as Record<string, unknown>;
      delete data.sessionId;
      delete data.createdAt;
      delete data.updatedAt;
      const ref = await addDoc(combatantsCol(campaignId, adventureId, toSessionId), {
        ...data,
        sessionId: toSessionId,
        createdAt: now,
        updatedAt: now,
      });
      idMap.set(snap.id, ref.id);
    }
  }

  const revealsSnap = await getDocs(mapRevealsCol(campaignId, adventureId, fromSessionId)).catch(
    () => null,
  );
  if (revealsSnap) {
    for (const snap of revealsSnap.docs) {
      await setDoc(mapRevealDoc(campaignId, adventureId, toSessionId, snap.id), {
        ...(snap.data() as SessionMapReveal),
        updatedAt: now,
      });
    }
  }

  if (fromCombat) {
    const order = fromCombat.order.map((id) => idMap.get(id)).filter((id): id is string => !!id);
    if (order.length > 0) {
      const turnIndex = Math.min(fromCombat.turnIndex, order.length - 1);
      await updateDoc(sessionDoc(campaignId, adventureId, toSessionId), {
        combat: { round: fromCombat.round, turnIndex, order } satisfies SessionCombat,
        updatedAt: now,
      });
    }
  }
}

/** A room key: 32 random bytes, URL-safe. */
function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Start a live session (fails softly if one is already active). Also flags the
 * adventure as live and, if it was still "upcoming", moves it to "active".
 */
export async function startLiveSession(
  campaignId: string,
  adventureId: string,
  startedBy: string,
  currentAdventureStatus?: "draft" | "upcoming" | "active" | "completed",
  /** The adventure's starting moment, for its first session. */
  start?: { day?: number; time?: string; date?: string },
  /** Play through a self-hosted realtime server at this URL (absent = Firestore). */
  realtimeUrl?: string,
): Promise<string> {
  if (currentAdventureStatus === "draft") throw new Error("ADVENTURE_DRAFT");

  const active = await getActiveLiveSession(campaignId, adventureId);
  if (active) {
    await run(() => setAdventureLiveSession(campaignId, adventureId, active.id));
    return active.id;
  }

  // A campaign runs at most one adventure at a time.
  const siblings = await listAdventures(campaignId).catch(() => []);
  const busy = siblings.find(
    (a) => a.id !== adventureId && (a.status === "active" || Boolean(a.liveSessionId)),
  );
  if (busy) throw new Error(`ADVENTURE_BUSY:${busy.title}`);

  // Resume where the last session left off (location, clock, combatants, fog,
  // and an in-progress combat). First session ever: a blank slate, its clock
  // set to the adventure's starting moment.
  const ended = await listEndedSessions(campaignId, adventureId).catch(
    () => [] as WithId<LiveSession>[],
  );
  const previous = ended[0] ?? null;

  const realtime = realtimeUrl
    ? { url: realtimeUrl.replace(/\/$/, ""), memberKey: randomKey(), gmKey: randomKey() }
    : null;
  const now = serverTimestamp();
  const ref = await addDoc(sessionsCol(campaignId, adventureId), {
    campaignId,
    adventureId,
    status: "live" as LiveSessionStatus,
    startedBy,
    startedAt: now,
    number: ended.length + 1,
    connectedUids: [startedBy],
    attendeeUids: [startedBy],
    ...(previous?.currentLocationId ? { currentLocationId: previous.currentLocationId } : {}),
    ...(previous?.clockLabel ? { clockLabel: previous.clockLabel } : {}),
    ...(previous?.gameDate ? { gameDate: previous.gameDate } : {}),
    ...(previous?.gameDay ? { gameDay: previous.gameDay } : {}),
    ...(!previous && start?.time ? { clockLabel: start.time } : {}),
    ...(!previous && start?.date ? { gameDate: start.date } : {}),
    ...(!previous && start?.day ? { gameDay: start.day } : {}),
    ...(realtime ? { realtime: { url: realtime.url, memberKey: realtime.memberKey } } : {}),
    createdAt: now,
    updatedAt: now,
  });
  if (realtime) {
    // The GM key stays in the GM-only half: holding it is acting as the GM.
    await setDoc(
      sessionGmDoc(campaignId, adventureId, ref.id),
      { realtimeGmKey: realtime.gmKey, createdAt: now, updatedAt: now },
      { merge: true },
    );
  }
  if (previous) {
    await run(() =>
      cloneSessionState(campaignId, adventureId, previous.id, ref.id, previous.combat),
    );
  }
  await run(() => setAdventureLiveSession(campaignId, adventureId, ref.id));
  // Once played, an adventure can never go back to "brouillon".
  await run(() =>
    updateAdventure(campaignId, adventureId, {
      hasPlayedSession: true,
      ...(currentAdventureStatus === "upcoming" ? { status: "active" as const } : {}),
    }),
  );
  return ref.id;
}

export function subscribeLiveSession(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  onChange: (session: WithId<LiveSession> | null) => void,
): () => void {
  return onSnapshot(sessionDoc(campaignId, adventureId, sessionId), (snapshot) => {
    onChange(snapshot.exists() ? parseDoc<LiveSession>(liveSessionSchema, snapshot) : null);
  });
}

export async function joinLiveSession(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  uid: string,
  /**
   * `false` through a realtime room: it knows who is here, so only the
   * attendance is written (once per player).
   */
  { presence = true }: { presence?: boolean } = {},
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    ...(presence ? { connectedUids: arrayUnion(uid) } : {}),
    attendeeUids: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function leaveLiveSession(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  uid: string,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    connectedUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function setLiveSessionStatus(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  status: LiveSessionStatus,
): Promise<void> {
  // One batch: the GM is sent back to the adventure page as soon as the session
  // reads "ended", and that page must not still see it as live.
  const batch = writeBatch(db);
  batch.update(sessionDoc(campaignId, adventureId, sessionId), {
    status,
    // Keep `combat` on the ended doc so the next session can resume it.
    ...(status === "ended" ? { endedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
  if (status === "ended") {
    batch.update(doc(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.adventures, adventureId), {
      liveSessionId: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// --- Combat (initiative order) --------------------------------------------

/** Start a combat with the given combatant ids sorted by initiative. */
export async function startCombat(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  order: string[],
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: { round: 1, turnIndex: 0, order } satisfies SessionCombat,
    updatedAt: serverTimestamp(),
  });
}

/** Set the whole combat (round, turn, order) — or end it with `null`. */
export async function setSessionCombat(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combat: SessionCombat | null,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: combat ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** Advance to the next combatant (wrapping to the next round). */
export async function advanceCombatTurn(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combat: SessionCombat,
): Promise<void> {
  if (combat.order.length === 0) return;
  const nextIndex = (combat.turnIndex + 1) % combat.order.length;
  const nextRound = nextIndex === 0 ? combat.round + 1 : combat.round;
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: { ...combat, turnIndex: nextIndex, round: nextRound } satisfies SessionCombat,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Slot new combatants into a running initiative order by score (ties go after
 * the existing ones), keeping the same combatant on turn.
 */
export async function addToCombatOrder(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combat: SessionCombat,
  entries: { id: string; initiative: number }[],
  initiativeById: ReadonlyMap<string, number>,
): Promise<void> {
  if (entries.length === 0) return;
  const activeId = combat.order[combat.turnIndex];
  const scores = new Map(initiativeById);
  const order = [...combat.order];
  for (const { id, initiative } of entries) {
    scores.set(id, initiative);
    const at = order.findIndex((other) => (scores.get(other) ?? -Infinity) < initiative);
    order.splice(at === -1 ? order.length : at, 0, id);
  }
  const turnIndex = Math.max(0, order.indexOf(activeId));
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: { ...combat, order, turnIndex } satisfies SessionCombat,
    updatedAt: serverTimestamp(),
  });
}

/** Remove a combatant from the initiative order (keeps the active turn sane). */
export async function removeFromCombatOrder(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combat: SessionCombat,
  combatantId: string,
): Promise<void> {
  const removedIndex = combat.order.indexOf(combatantId);
  if (removedIndex === -1) return;
  const order = combat.order.filter((id) => id !== combatantId);
  let turnIndex = combat.turnIndex;
  if (removedIndex < combat.turnIndex) turnIndex -= 1;
  if (order.length === 0) {
    await endCombat(campaignId, adventureId, sessionId);
    return;
  }
  turnIndex = ((turnIndex % order.length) + order.length) % order.length;
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: { ...combat, order, turnIndex } satisfies SessionCombat,
    updatedAt: serverTimestamp(),
  });
}

/** Remember enemies that fell, for the recap: the combat itself is wiped at its end. */
export async function recordDefeated(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  enemies: DefeatedEnemy[],
): Promise<void> {
  if (enemies.length === 0) return;
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    defeated: arrayUnion(...enemies.map(({ id, name }) => ({ id, name }))),
    updatedAt: serverTimestamp(),
  });
}

export async function endCombat(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    combat: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** The location the GM shows on the map. Pass `null` for "aucun lieu". */
export interface SessionLocationTarget {
  id: string;
  name: string;
  imageUrl?: string;
  hidden?: boolean;
}

export async function setSessionLocation(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  location: SessionLocationTarget | null,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    currentLocationId: location?.id ?? deleteField(),
    ...(location ? { visitedLocationIds: arrayUnion(location.id) } : {}),
    updatedAt: serverTimestamp(),
  });
  // Snapshot the visited location so its map stays reviewable from the
  // adventure page even after the session ends (players lose `locations` read).
  if (location) {
    await setDoc(
      mapRevealDoc(campaignId, adventureId, sessionId, location.id),
      {
        sessionId,
        locationId: location.id,
        name: location.name,
        imageUrl: location.imageUrl ?? deleteField(),
        hidden: location.hidden ?? false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    // A place the party has seen joins the codex.
    await run(() => revealLocationInCodex(campaignId, adventureId, location));
  }
}

// --- Recap -----------------------------------------------------------------

/** The GM-only side of a session (recap draft, private notes). */
export async function getSessionGm(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<LiveSessionGm | null> {
  const snapshot = await getDoc(sessionGmDoc(campaignId, adventureId, sessionId));
  return snapshot.exists() ? parseDoc<LiveSessionGm>(liveSessionGmSchema, snapshot) : null;
}

export interface RecapDraft {
  title: string;
  recap: string;
  gmNotes: string;
}

/** Save the GM's draft — nothing reaches the players. */
export async function saveSessionDraft(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  draft: RecapDraft,
): Promise<void> {
  const now = serverTimestamp();
  await setDoc(
    sessionGmDoc(campaignId, adventureId, sessionId),
    {
      titleDraft: draft.title.trim() || deleteField(),
      recapDraft: draft.recap.trim() || deleteField(),
      gmNotes: draft.gmNotes.trim() || deleteField(),
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );
}

/** Save the draft and copy it onto the session, where every member reads it. */
export async function publishSessionRecap(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  draft: RecapDraft,
): Promise<void> {
  if (!draft.recap.trim()) throw new Error("EMPTY_RECAP");
  await saveSessionDraft(campaignId, adventureId, sessionId, draft);
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    title: draft.title.trim() || deleteField(),
    recap: draft.recap.trim(),
    recapPublishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await run(() => updateAdventure(campaignId, adventureId, { lastRecapAt: Date.now() }));
}

/** Take the recap back from the players; the draft stays. */
export async function unpublishSessionRecap(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    title: deleteField(),
    recap: deleteField(),
    recapPublishedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** Every ended session for an adventure, most recent first. */
export async function listEndedSessions(
  campaignId: string,
  adventureId: string,
): Promise<WithId<LiveSession>[]> {
  const snapshot = await getDocs(
    query(sessionsCol(campaignId, adventureId), where("status", "==", "ended")),
  );
  return snapshot.docs
    .map((d) => parseDoc<LiveSession>(liveSessionSchema, d))
    .sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt));
}

/** What the campaign page says of an adventure: its sessions played, the last one and recap. */
export interface AdventurePlays {
  played: number;
  /** When the last session started (ms). */
  lastPlayedAt?: number;
  /** The most recent published recap (Markdown). */
  lastRecap?: string;
}

export async function loadAdventurePlays(
  campaignId: string,
  adventureId: string,
): Promise<AdventurePlays> {
  const ended = await listEndedSessions(campaignId, adventureId);
  return {
    played: ended.length,
    lastPlayedAt: ended[0] ? toMillis(ended[0].startedAt) : undefined,
    lastRecap: ended.find((session) => session.recap)?.recap,
  };
}

/** The GM's game clock: the time, and the day it may have rolled over to. */
export async function setSessionClock(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  time: GameTime,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    clockLabel: time.time || undefined,
    gameDay: time.day,
    updatedAt: serverTimestamp(),
  });
}

// --- Combatants (fight roster + map tokens) --------------------------------

const combatantsCol = (campaignId: string, adventureId: string, sessionId: string) =>
  collection(sessionDoc(campaignId, adventureId, sessionId), COLLECTIONS.combatants);

export interface AddCombatantInput {
  kind: SessionCombatant["kind"];
  refId: string;
  name: string;
  color?: string;
  maxHitPoints: number;
  currentHitPoints: number;
  armorClass: number;
  playerId?: string;
  /** Place the token on the map straight away. */
  onMap?: boolean;
  /** Where on the map (fractions); the centre by default. */
  x?: number;
  y?: number;
  initiative?: number;
  /** The creature's size: its token covers as many squares. */
  size?: SessionCombatant["size"];
  /** An enemy profile fighting on the party's side (an allied NPC). */
  ally?: boolean;
}

export async function addCombatant(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  input: AddCombatantInput,
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(combatantsCol(campaignId, adventureId, sessionId), {
    sessionId,
    kind: input.kind,
    refId: input.refId,
    name: input.name,
    color: input.color,
    maxHitPoints: input.maxHitPoints,
    currentHitPoints: input.currentHitPoints,
    armorClass: input.armorClass,
    playerId: input.playerId,
    initiative: input.initiative,
    ...(input.size ? { size: input.size } : {}),
    ...(input.ally ? { ally: true } : {}),
    onMap: input.onMap ?? false,
    x: input.x ?? 0.5,
    y: input.y ?? 0.5,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateCombatant(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combatantId: string,
  patch: Partial<
    Pick<
      SessionCombatant,
      | "currentHitPoints"
      | "onMap"
      | "x"
      | "y"
      | "name"
      | "initiative"
      | "conditions"
      | "armorClass"
      | "size"
    >
  >,
): Promise<void> {
  await updateDoc(doc(combatantsCol(campaignId, adventureId, sessionId), combatantId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function removeCombatant(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  combatantId: string,
): Promise<void> {
  await deleteDoc(doc(combatantsCol(campaignId, adventureId, sessionId), combatantId));
}

export function subscribeCombatants(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  onChange: (combatants: WithId<SessionCombatant>[]) => void,
): () => void {
  return onSnapshot(combatantsCol(campaignId, adventureId, sessionId), (snapshot) => {
    onChange(snapshot.docs.map((d) => parseDoc<SessionCombatant>(sessionCombatantSchema, d)));
  });
}

// --- Map reveal (fog of war for hidden locations) ------------------------

/**
 * Commit a hidden location's whole reveal mask (base64 bitfield + grid dims).
 * One write per tool release — see {@link SessionMap}.
 */
export async function setMapReveal(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  locationId: string,
  data: { mask: string; cols: number; rows: number },
): Promise<void> {
  await setDoc(
    mapRevealDoc(campaignId, adventureId, sessionId, locationId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Live listener for a single location's reveal state. */
export function subscribeMapReveal(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  locationId: string,
  onChange: (reveal: WithId<SessionMapReveal> | null) => void,
): () => void {
  return onSnapshot(mapRevealDoc(campaignId, adventureId, sessionId, locationId), (snapshot) => {
    onChange(
      snapshot.exists() ? parseDoc<SessionMapReveal>(sessionMapRevealSchema, snapshot) : null,
    );
  });
}

/** Every map-reveal snapshot for a session (past-session history). */
export async function listMapReveals(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<WithId<SessionMapReveal>[]> {
  const snapshot = await getDocs(mapRevealsCol(campaignId, adventureId, sessionId));
  return snapshot.docs.map((d) => parseDoc<SessionMapReveal>(sessionMapRevealSchema, d));
}

/** GM: keep a player's journal entry out of (or back into) a session's chronicle. */
export async function setJournalEntryHidden(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  entryId: string,
  hidden: boolean,
): Promise<void> {
  await updateDoc(sessionDoc(campaignId, adventureId, sessionId), {
    hiddenEntryIds: hidden ? arrayUnion(entryId) : arrayRemove(entryId),
    updatedAt: serverTimestamp(),
  });
}

/** The combatants as Firestore has them (to seed a realtime room). */
export async function listCombatants(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<WithId<SessionCombatant>[]> {
  const snapshot = await getDocs(combatantsCol(campaignId, adventureId, sessionId));
  return snapshot.docs.map((d) => parseDoc<SessionCombatant>(sessionCombatantSchema, d));
}

/**
 * The characters' play state the room holds, into their participant docs:
 * every few minutes from the GM's tab, and at the session's end. Only what
 * changed (see `participantsToSave`).
 */
export async function persistRoomParticipants(
  campaignId: string,
  adventureId: string,
  saves: { characterId: string; patch: RoomParticipantLive }[],
): Promise<void> {
  if (saves.length === 0) return;
  const batch = writeBatch(db);
  for (const { characterId, patch } of saves) {
    batch.update(
      doc(
        db,
        COLLECTIONS.campaigns,
        campaignId,
        COLLECTIONS.adventures,
        adventureId,
        COLLECTIONS.participants,
        characterId,
      ),
      { ...patch, updatedAt: serverTimestamp() },
    );
  }
  await batch.commit();
}

/**
 * Copy a realtime room's state back into Firestore — at the session's end, so
 * the next session (whichever way it is played) starts from it, and the
 * chronicle keeps its fallen enemies.
 */
export async function persistRoomState(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  state: RoomState,
): Promise<void> {
  const existing = await getDocs(combatantsCol(campaignId, adventureId, sessionId));
  const batch = writeBatch(db);
  for (const docSnap of existing.docs) {
    if (!state.combatants[docSnap.id]) batch.delete(docSnap.ref);
  }
  const now = serverTimestamp();
  for (const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } of Object.values(
    state.combatants,
  )) {
    batch.set(doc(combatantsCol(campaignId, adventureId, sessionId), id), {
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  }
  // The fog painted through the room: each place's final mask.
  for (const [locationId, fog] of Object.entries(state.fog ?? {})) {
    batch.set(
      mapRevealDoc(campaignId, adventureId, sessionId, locationId),
      { ...fog, updatedAt: now },
      { merge: true },
    );
  }
  batch.update(sessionDoc(campaignId, adventureId, sessionId), {
    combat: state.combat ?? deleteField(),
    updatedAt: now,
  });
  await batch.commit();
}
