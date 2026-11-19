import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  COLLECTIONS,
  LIVE_SESSION_GM_DOC_ID,
  LIVE_SESSION_PRIVATE_COLLECTION,
  sessionQuoteSchema,
  type LootItem,
  type QuickNote,
  type SessionQuote,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { parseDoc, toMillis } from "@/lib/firestore";

const sessionRef = (campaignId: string, adventureId: string, sessionId: string) =>
  doc(
    db,
    COLLECTIONS.campaigns,
    campaignId,
    COLLECTIONS.adventures,
    adventureId,
    COLLECTIONS.liveSessions,
    sessionId,
  );
const quotesCol = (campaignId: string, adventureId: string, sessionId: string) =>
  collection(sessionRef(campaignId, adventureId, sessionId), COLLECTIONS.quotes);

// --- Quotes ------------------------------------------------------------------

const oldestFirst = (a: SessionQuote, b: SessionQuote) =>
  toMillis(a.createdAt) - toMillis(b.createdAt);

export function subscribeQuotes(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  onChange: (quotes: WithId<SessionQuote>[]) => void,
): () => void {
  return onSnapshot(quotesCol(campaignId, adventureId, sessionId), (snapshot) => {
    onChange(
      snapshot.docs.map((d) => parseDoc<SessionQuote>(sessionQuoteSchema, d)).sort(oldestFirst),
    );
  });
}

export async function listQuotes(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<WithId<SessionQuote>[]> {
  const snapshot = await getDocs(quotesCol(campaignId, adventureId, sessionId));
  return snapshot.docs.map((d) => parseDoc<SessionQuote>(sessionQuoteSchema, d)).sort(oldestFirst);
}

export async function addQuote(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  input: { text: string; speaker: string },
  authorUid: string,
): Promise<void> {
  const now = serverTimestamp();
  await addDoc(quotesCol(campaignId, adventureId, sessionId), {
    text: input.text.trim(),
    ...(input.speaker.trim() ? { speaker: input.speaker.trim() } : {}),
    authorUid,
    createdAt: now,
    updatedAt: now,
  });
}

export function deleteQuote(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  quoteId: string,
): Promise<void> {
  return deleteDoc(doc(quotesCol(campaignId, adventureId, sessionId), quoteId));
}

// --- GM: quick notes, in-game date, loot ----------------------------------------

/** A note the GM jots during play; it waits in the GM-only doc for the recap. */
export async function addQuickNote(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  text: string,
): Promise<void> {
  const note: QuickNote = { at: Date.now(), text: text.trim() };
  await setDoc(
    doc(
      sessionRef(campaignId, adventureId, sessionId),
      LIVE_SESSION_PRIVATE_COLLECTION,
      LIVE_SESSION_GM_DOC_ID,
    ),
    { quickNotes: arrayUnion(note), updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setGameDate(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  gameDate: string,
): Promise<void> {
  await updateDoc(sessionRef(campaignId, adventureId, sessionId), {
    gameDate: gameDate.trim() || deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function addLoot(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  input: { name: string; quantity?: number; where?: string },
): Promise<void> {
  const item: LootItem = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    ...(input.quantity && input.quantity > 1 ? { quantity: input.quantity } : {}),
    ...(input.where?.trim() ? { where: input.where.trim() } : {}),
  };
  await updateDoc(sessionRef(campaignId, adventureId, sessionId), {
    loot: arrayUnion(item),
    updatedAt: serverTimestamp(),
  });
}

export async function removeLoot(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  item: LootItem,
): Promise<void> {
  await updateDoc(sessionRef(campaignId, adventureId, sessionId), {
    loot: arrayRemove(item),
    updatedAt: serverTimestamp(),
  });
}

/** The GM's quick notes for a session, live. */
export function subscribeQuickNotes(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  onChange: (notes: QuickNote[]) => void,
): () => void {
  return onSnapshot(
    doc(
      sessionRef(campaignId, adventureId, sessionId),
      LIVE_SESSION_PRIVATE_COLLECTION,
      LIVE_SESSION_GM_DOC_ID,
    ),
    (snapshot) => {
      const notes = (snapshot.data()?.quickNotes ?? []) as QuickNote[];
      onChange([...notes].sort((a, b) => a.at - b.at));
    },
  );
}
