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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  COLLECTIONS,
  adventureParticipantSchema,
  adventureSchema,
  campaignMemberSchema,
  type Adventure,
  type AdventureParticipant,
  type AdventureParticipantLiveUpdate,
  type AdventureStatus,
  type CampaignMember,
  LIVE_SESSION_PRIVATE_COLLECTION,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import type { WithId } from "@adventure-keeper/schemas";
import { adventureCollectionRef, adventureSubCollection } from "@/lib/adventure-crud";
import { deleteAllDocs, parseDoc } from "@/lib/firestore";
import {
  adventureInProgress,
  holdingAdventure,
  type CharacterEngagement,
} from "@/lib/character-lock";

// Per-entity CRUD lives in its own module; re-exported here so callers keep a
// single `@/lib/adventures` entry point.
export * from "@/lib/adventure-locations";
export * from "@/lib/adventure-enemies";
export * from "@/lib/adventure-npcs";
export * from "@/lib/adventure-events";

const adventuresCol = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.adventures);

// --- Members -------------------------------------------------------------

export async function listCampaignMembers(campaignId: string): Promise<WithId<CampaignMember>[]> {
  const snapshot = await getDocs(
    collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.members),
  );
  return snapshot.docs.map((d) => parseDoc<CampaignMember>(campaignMemberSchema, d));
}

// --- Adventures --------------------------------------------------------------

export interface CreateAdventureInput {
  title: string;
  summary?: string;
}

export async function createAdventure(
  campaignId: string,
  input: CreateAdventureInput,
  createdBy: string,
): Promise<string> {
  const now = serverTimestamp();
  const existing = await getDocs(adventuresCol(campaignId));
  const ref = await addDoc(adventuresCol(campaignId), {
    campaignId,
    createdBy,
    title: input.title,
    summary: input.summary,
    status: "draft" satisfies AdventureStatus,
    order: existing.size,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listAdventures(campaignId: string): Promise<WithId<Adventure>[]> {
  const snapshot = await getDocs(query(adventuresCol(campaignId), orderBy("order", "asc")));
  return snapshot.docs.map((d) => parseDoc<Adventure>(adventureSchema, d));
}

export function subscribeAdventures(
  campaignId: string,
  onChange: (adventures: WithId<Adventure>[]) => void,
): () => void {
  return onSnapshot(query(adventuresCol(campaignId), orderBy("order", "asc")), (snapshot) => {
    onChange(snapshot.docs.map((d) => parseDoc<Adventure>(adventureSchema, d)));
  });
}

/**
 * Adventures a given player takes part in (via the denormalised `playerIds`),
 * excluding drafts. A filtered query is required: once the rules restrict
 * per-adventure reads, an unfiltered collection listen fails wholesale on the
 * first forbidden doc. Drafts are dropped client-side (`array-contains` cannot
 * be combined with a `status` inequality in one query).
 */
/** One-shot list of the adventures a player takes part in (no drafts). */
export async function listAdventuresForPlayer(
  campaignId: string,
  uid: string,
): Promise<WithId<Adventure>[]> {
  const snapshot = await getDocs(
    query(adventuresCol(campaignId), where("playerIds", "array-contains", uid)),
  );
  return snapshot.docs
    .map((d) => parseDoc<Adventure>(adventureSchema, d))
    .filter((a) => a.status !== "draft");
}

export function subscribeAdventuresForPlayer(
  campaignId: string,
  uid: string,
  onChange: (adventures: WithId<Adventure>[]) => void,
): () => void {
  return onSnapshot(
    query(adventuresCol(campaignId), where("playerIds", "array-contains", uid)),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((d) => parseDoc<Adventure>(adventureSchema, d))
          .filter((a) => a.status !== "draft")
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      );
    },
  );
}

/** Live single-adventure listener — the session views need the adventure doc
 * (condition tracking…) to react in real time. */
export function subscribeAdventure(
  campaignId: string,
  adventureId: string,
  onChange: (adventure: WithId<Adventure> | null) => void,
): () => void {
  return onSnapshot(doc(adventuresCol(campaignId), adventureId), (snapshot) => {
    onChange(snapshot.exists() ? parseDoc<Adventure>(adventureSchema, snapshot) : null);
  });
}

/** Set / clear the live session the adventure is currently running. */
export async function setAdventureLiveSession(
  campaignId: string,
  adventureId: string,
  sessionId: string | null,
): Promise<void> {
  await updateDoc(doc(adventuresCol(campaignId), adventureId), {
    liveSessionId: sessionId ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function getAdventure(
  campaignId: string,
  adventureId: string,
): Promise<WithId<Adventure> | null> {
  const snapshot = await getDoc(doc(adventuresCol(campaignId), adventureId));
  return snapshot.exists() ? parseDoc<Adventure>(adventureSchema, snapshot) : null;
}

export async function updateAdventure(
  campaignId: string,
  adventureId: string,
  patch: Partial<
    Pick<
      Adventure,
      "title" | "summary" | "status" | "conditionsEnabled" | "hasPlayedSession" | "lastRecapAt"
    >
  >,
): Promise<void> {
  await updateDoc(doc(adventuresCol(campaignId), adventureId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** The adventure's starting moment (clock of its first session); blank fields are cleared. */
export async function setAdventureStart(
  campaignId: string,
  adventureId: string,
  start: { day?: number; time?: string; date?: string },
): Promise<void> {
  await updateDoc(doc(adventuresCol(campaignId), adventureId), {
    startDay: start.day ?? deleteField(),
    startTime: start.time || deleteField(),
    startDate: start.date?.trim() || deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an adventure and everything under it: locations, enemies, NPCs,
 * events, participants, and each live session with its combatants. The
 * adventure document itself goes last so the child deletes still satisfy the
 * `ownsCampaign()` rule (which reads the campaign, not the adventure).
 */
export async function deleteAdventure(campaignId: string, adventureId: string): Promise<void> {
  const sub = (segment: string) => adventureCollectionRef(campaignId, adventureId, segment);

  // Live sessions nest a `combatants` subcollection — clear those first.
  const liveSessions = await getDocs(sub(COLLECTIONS.liveSessions));
  await Promise.all(
    liveSessions.docs.flatMap((s) => [
      deleteAllDocs(collection(s.ref, COLLECTIONS.combatants)),
      deleteAllDocs(collection(s.ref, COLLECTIONS.mapReveals)),
      deleteAllDocs(collection(s.ref, LIVE_SESSION_PRIVATE_COLLECTION)),
      deleteAllDocs(collection(s.ref, COLLECTIONS.quotes)),
    ]),
  );

  await Promise.all([
    deleteAllDocs(sub(COLLECTIONS.locations)),
    deleteAllDocs(sub(COLLECTIONS.locationSecrets)),
    deleteAllDocs(sub(COLLECTIONS.enemies)),
    deleteAllDocs(sub(COLLECTIONS.npcs)),
    deleteAllDocs(sub(COLLECTIONS.events)),
    deleteAllDocs(sub(COLLECTIONS.participants)),
    deleteAllDocs(sub(COLLECTIONS.liveSessions)),
  ]);

  await deleteDoc(doc(adventuresCol(campaignId), adventureId));
}

// --- Participants -----------------------------------------------------------
// Kept here (not in a per-entity module): adding / removing a participant also
// mutates the parent adventure's denormalised `playerIds`.

const participants = adventureSubCollection<AdventureParticipant>(COLLECTIONS.participants, {
  schema: adventureParticipantSchema,
});

export interface AddParticipantInput {
  characterId: string;
  playerId: string;
  characterName: string;
  currentHitPoints?: number;
}

export const listParticipants = participants.list;
export const subscribeParticipants = participants.subscribe;

export async function addParticipant(
  campaignId: string,
  adventureId: string,
  input: AddParticipantInput,
): Promise<void> {
  const now = serverTimestamp();
  await setDoc(doc(participants.col(campaignId, adventureId), input.characterId), {
    campaignId,
    adventureId,
    characterId: input.characterId,
    playerId: input.playerId,
    characterName: input.characterName,
    currentHitPoints: input.currentHitPoints,
    createdAt: now,
    updatedAt: now,
  });
  // Keep the adventure's denormalised player list in sync (drives visibility).
  await updateDoc(doc(adventuresCol(campaignId), adventureId), {
    playerIds: arrayUnion(input.playerId),
    updatedAt: now,
  });
}

export async function removeParticipant(
  campaignId: string,
  adventureId: string,
  characterId: string,
  playerId?: string,
): Promise<void> {
  await participants.remove(campaignId, adventureId, characterId);
  if (playerId) {
    await updateDoc(doc(adventuresCol(campaignId), adventureId), {
      playerIds: arrayRemove(playerId),
      updatedAt: serverTimestamp(),
    });
  }
}

export function updateParticipant(
  campaignId: string,
  adventureId: string,
  characterId: string,
  patch: AdventureParticipantLiveUpdate,
): Promise<void> {
  return participants.patch(campaignId, adventureId, characterId, patch);
}

/**
 * For each character of the roster, the adventure in progress holding it (or
 * `null`). One query for the player's adventures (the `playerIds` filter the
 * rules require), then one participant read per adventure in progress and character.
 */
export async function loadCharacterHolds(
  campaignId: string,
  uid: string,
  characterIds: readonly string[],
): Promise<Record<string, WithId<Adventure> | null>> {
  const col = adventuresCol(campaignId);
  const snapshot = await getDocs(query(col, where("playerIds", "array-contains", uid)));
  const inProgress = snapshot.docs
    .map((d) => parseDoc<Adventure>(adventureSchema, d))
    .filter(adventureInProgress);

  const entries = await Promise.all(
    characterIds.map(async (characterId) => {
      const engagements = await Promise.all(
        inProgress.map(async (adventure): Promise<CharacterEngagement | null> => {
          const participant = await getDoc(
            doc(col, adventure.id, COLLECTIONS.participants, characterId),
          );
          return participant.exists()
            ? {
                adventure,
                participant: parseDoc<AdventureParticipant>(
                  adventureParticipantSchema,
                  participant,
                ),
              }
            : null;
        }),
      );
      const held = engagements.filter((entry): entry is CharacterEngagement => entry !== null);
      return [characterId, holdingAdventure(held)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
