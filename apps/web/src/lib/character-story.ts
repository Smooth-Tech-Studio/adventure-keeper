import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  COLLECTIONS,
  campaignMemberSchema,
  characterChapterSchema,
  journalEntrySchema,
  memberCharacterIds,
  type Campaign,
  type CampaignMember,
  type CharacterChapter,
  type CharacterPersonality,
  type JournalEntry,
  type StoryVisibility,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { listMyCampaigns } from "@/lib/campaigns";
import { parseDoc, toMillis } from "@/lib/firestore";

const chaptersCol = (characterId: string) =>
  collection(db, COLLECTIONS.characters, characterId, COLLECTIONS.chapters);
const journalCol = (characterId: string) =>
  collection(db, COLLECTIONS.characters, characterId, COLLECTIONS.journal);

/** Who reads it, and within which campaign (needed unless `private`). */
export interface StorySharing {
  visibility: StoryVisibility;
  campaignId?: string;
}

/** `visibility` + `campaignId` to write; `update` clears a dropped campaign. */
function sharingFields(sharing: StorySharing, mode: "create" | "update") {
  if (sharing.visibility !== "private" && !sharing.campaignId) {
    throw new Error("STORY_NEEDS_CAMPAIGN");
  }
  if (sharing.campaignId) return { visibility: sharing.visibility, campaignId: sharing.campaignId };
  return mode === "update"
    ? { visibility: sharing.visibility, campaignId: deleteField() }
    : { visibility: sharing.visibility };
}

/**
 * What others can list of a character's story within a campaign: the party's
 * share, plus the GM's when the reader runs that campaign. One query per
 * visibility — the rules only accept queries that pin both fields.
 */
async function sharedDocs<T>(
  source: (visibility: StoryVisibility) => Query,
  isGm: boolean,
  parse: (snapshot: QueryDocumentSnapshot) => WithId<T>,
): Promise<WithId<T>[]> {
  const visibilities: StoryVisibility[] = isGm ? ["party", "gm"] : ["party"];
  const snapshots = await Promise.all(visibilities.map((v) => getDocs(source(v))));
  return snapshots.flatMap((s) => s.docs.map(parse));
}

// --- Chapters --------------------------------------------------------------

const parseChapter = (d: QueryDocumentSnapshot) =>
  parseDoc<CharacterChapter>(characterChapterSchema, d);
const byOrder = (a: CharacterChapter, b: CharacterChapter) => a.order - b.order;

/** Every chapter (owner only), in story order. */
export async function listChapters(characterId: string): Promise<WithId<CharacterChapter>[]> {
  const snapshot = await getDocs(chaptersCol(characterId));
  return snapshot.docs.map(parseChapter).sort(byOrder);
}

/** The chapters shared within a campaign, for its GM or its party. */
export async function listSharedChapters(
  characterId: string,
  campaignId: string,
  isGm: boolean,
): Promise<WithId<CharacterChapter>[]> {
  const rows = await sharedDocs<CharacterChapter>(
    (visibility) =>
      query(
        chaptersCol(characterId),
        where("campaignId", "==", campaignId),
        where("visibility", "==", visibility),
      ),
    isGm,
    parseChapter,
  );
  return rows.sort(byOrder);
}

export interface ChapterInput extends StorySharing {
  title: string;
  body: string;
  imageUrl?: string;
}

export async function addChapter(
  characterId: string,
  ownerId: string,
  input: ChapterInput,
  order: number,
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(chaptersCol(characterId), {
    ownerId,
    characterId,
    title: input.title.trim(),
    body: input.body.trim(),
    ...(input.imageUrl?.trim() ? { imageUrl: input.imageUrl.trim() } : {}),
    order,
    ...sharingFields(input, "create"),
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateChapter(
  characterId: string,
  chapterId: string,
  input: ChapterInput,
): Promise<void> {
  await updateDoc(doc(chaptersCol(characterId), chapterId), {
    title: input.title.trim(),
    body: input.body.trim(),
    imageUrl: input.imageUrl?.trim() || deleteField(),
    ...sharingFields(input, "update"),
    updatedAt: serverTimestamp(),
  });
}

export function deleteChapter(characterId: string, chapterId: string): Promise<void> {
  return deleteDoc(doc(chaptersCol(characterId), chapterId));
}

/** Swap two chapters (move up / down). */
export async function swapChapters(
  characterId: string,
  a: WithId<CharacterChapter>,
  b: WithId<CharacterChapter>,
): Promise<void> {
  await Promise.all([
    updateDoc(doc(chaptersCol(characterId), a.id), {
      order: b.order,
      updatedAt: serverTimestamp(),
    }),
    updateDoc(doc(chaptersCol(characterId), b.id), {
      order: a.order,
      updatedAt: serverTimestamp(),
    }),
  ]);
}

// --- Journal ---------------------------------------------------------------

const parseEntry = (d: QueryDocumentSnapshot) => parseDoc<JournalEntry>(journalEntrySchema, d);
const newestFirst = (a: JournalEntry, b: JournalEntry) =>
  toMillis(b.createdAt) - toMillis(a.createdAt);

/** The whole journal (owner only), newest first. */
export async function listJournal(characterId: string): Promise<WithId<JournalEntry>[]> {
  const snapshot = await getDocs(journalCol(characterId));
  return snapshot.docs.map(parseEntry).sort(newestFirst);
}

/** One character's entries shared within a campaign, for its GM or its party. */
export async function listSharedJournal(
  characterId: string,
  campaignId: string,
  isGm: boolean,
): Promise<WithId<JournalEntry>[]> {
  const rows = await sharedDocs<JournalEntry>(
    (visibility) =>
      query(
        journalCol(characterId),
        where("campaignId", "==", campaignId),
        where("visibility", "==", visibility),
      ),
    isGm,
    parseEntry,
  );
  return rows.sort(newestFirst);
}

/** Every character's entries about one session, as the chronicle shows them. */
export async function listSessionJournal(
  campaignId: string,
  sessionId: string,
  isGm: boolean,
): Promise<WithId<JournalEntry>[]> {
  const rows = await sharedDocs<JournalEntry>(
    (visibility) =>
      query(
        collectionGroup(db, COLLECTIONS.journal),
        where("campaignId", "==", campaignId),
        where("sessionId", "==", sessionId),
        where("visibility", "==", visibility),
      ),
    isGm,
    parseEntry,
  );
  return rows.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
}

/** The reader's own entries about one session, whatever their visibility. */
export async function listMySessionEntries(
  uid: string,
  sessionId: string,
): Promise<WithId<JournalEntry>[]> {
  const snapshot = await getDocs(
    query(
      collectionGroup(db, COLLECTIONS.journal),
      where("ownerId", "==", uid),
      where("sessionId", "==", sessionId),
    ),
  );
  return snapshot.docs.map(parseEntry);
}

/** Where an entry was lived: snapshot so it reads well after the campaign is gone. */
export interface JournalContext {
  campaignId?: string;
  campaignName?: string;
  adventureId?: string;
  adventureTitle?: string;
  sessionId?: string;
  sessionNumber?: number;
}

export interface JournalInput extends StorySharing {
  title: string;
  body: string;
}

export async function addJournalEntry(
  characterId: string,
  ownerId: string,
  characterName: string,
  input: JournalInput,
  context: JournalContext = {},
): Promise<string> {
  const now = serverTimestamp();
  const defined = Object.fromEntries(Object.entries(context).filter(([, v]) => v !== undefined));
  const ref = await addDoc(journalCol(characterId), {
    ownerId,
    characterId,
    characterName,
    ...defined,
    ...sharingFields({ ...input, campaignId: input.campaignId ?? context.campaignId }, "create"),
    ...(input.title.trim() ? { title: input.title.trim() } : {}),
    body: input.body.trim(),
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export interface JournalUpdate extends JournalInput {
  /** The adventure it is filed under; `null` files it under none, left out keeps it. */
  adventureId?: string | null;
  adventureTitle?: string | null;
}

export async function updateJournalEntry(
  characterId: string,
  entryId: string,
  input: JournalUpdate,
): Promise<void> {
  const filed =
    input.adventureId === undefined
      ? {}
      : input.adventureId
        ? { adventureId: input.adventureId, adventureTitle: input.adventureTitle ?? deleteField() }
        : { adventureId: deleteField(), adventureTitle: deleteField() };
  await updateDoc(doc(journalCol(characterId), entryId), {
    title: input.title.trim() || deleteField(),
    body: input.body.trim(),
    ...sharingFields(input, "update"),
    ...filed,
    updatedAt: serverTimestamp(),
  });
}

/** How many adventures the journal tells of — the count on its tab. */
export function journalAdventureCount(entries: JournalEntry[]): number {
  return new Set(entries.map((entry) => entry.adventureId).filter(Boolean)).size;
}

export function deleteJournalEntry(characterId: string, entryId: string): Promise<void> {
  return deleteDoc(doc(journalCol(characterId), entryId));
}

// --- Context ---------------------------------------------------------------

/**
 * The campaigns this character plays in — where its owner can share a chapter
 * or an entry. One member read per campaign of the owner.
 */
export async function listCharacterCampaigns(
  ownerId: string,
  characterId: string,
): Promise<WithId<Campaign>[]> {
  const campaigns = await listMyCampaigns(ownerId);
  const members = await Promise.all(
    campaigns.map((c) =>
      getDoc(doc(db, COLLECTIONS.campaigns, c.id, COLLECTIONS.members, ownerId))
        .then((d) => (d.exists() ? parseDoc<CampaignMember>(campaignMemberSchema, d) : null))
        .catch(() => null),
    ),
  );
  return campaigns.filter((_, i) => {
    const member = members[i];
    return member ? memberCharacterIds(member).includes(characterId) : false;
  });
}

/** Personality traits, ideals, bonds, flaws (owner only). Empty lines are dropped. */
export async function setCharacterPersonality(
  characterId: string,
  personality: CharacterPersonality,
): Promise<void> {
  const kept = Object.fromEntries(
    Object.entries(personality)
      .map(([k, v]) => [k, v?.trim()])
      .filter(([, v]) => v),
  );
  await updateDoc(doc(db, COLLECTIONS.characters, characterId), {
    personality: Object.keys(kept).length > 0 ? kept : deleteField(),
    updatedAt: serverTimestamp(),
  });
}
