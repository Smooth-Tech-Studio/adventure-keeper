import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  COLLECTIONS,
  questSchema,
  type Quest,
  type QuestMilestone,
  type QuestStatus,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { deleteAllDocs, parseDoc } from "@/lib/firestore";

const questsCol = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.quests);

/** The GM reads every quest; a player the revealed ones (the rules demand the filter). */
const questsSource = (campaignId: string, isGm: boolean) =>
  isGm ? questsCol(campaignId) : query(questsCol(campaignId), where("revealed", "==", true));

const parseQuests = (docs: Parameters<typeof parseDoc>[1][]) =>
  docs
    .map((d) => parseDoc<Quest>(questSchema, d))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

/**
 * The quests this reader may see, live. A player passing their `uid` also gets
 * their own personal quests — a second query, the rules allowing no « or ».
 */
export function subscribeQuests(
  campaignId: string,
  isGm: boolean,
  onChange: (quests: WithId<Quest>[]) => void,
  uid?: string,
): () => void {
  if (isGm || !uid) {
    return onSnapshot(questsSource(campaignId, isGm), (snapshot) =>
      onChange(parseQuests(snapshot.docs)),
    );
  }
  type Docs = Parameters<typeof parseDoc>[1][];
  let shared: Docs | null = null;
  let own: Docs | null = null;
  const emit = () => {
    if (!shared || !own) return;
    // A shared quest of one's own comes back from both queries: once is enough.
    const byId = new Map([...shared, ...own].map((d) => [d.id, d]));
    onChange(parseQuests([...byId.values()]));
  };
  const unsubShared = onSnapshot(questsSource(campaignId, false), (snapshot) => {
    shared = snapshot.docs;
    emit();
  });
  const unsubOwn = onSnapshot(query(questsCol(campaignId), where("ownerUid", "==", uid)), (s) => {
    own = s.docs;
    emit();
  });
  return () => {
    unsubShared();
    unsubOwn();
  };
}

/** One read of the quests (the chronicle book). */
export async function listQuests(campaignId: string, isGm: boolean): Promise<WithId<Quest>[]> {
  return parseQuests((await getDocs(questsSource(campaignId, isGm))).docs);
}

export interface QuestInput {
  title: string;
  summary: string;
  status: QuestStatus;
  revealed: boolean;
}

export const EMPTY_QUEST: QuestInput = {
  title: "",
  summary: "",
  status: "rumor",
  revealed: false,
};

export async function addQuest(
  campaignId: string,
  input: QuestInput,
  order: number,
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(questsCol(campaignId), {
    campaignId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    status: input.status,
    revealed: input.revealed,
    order,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/** A player's own quest: personal, or shared with the party (`shared`). */
export async function addPlayerQuest(
  campaignId: string,
  owner: { uid: string; name: string },
  input: { title: string; summary: string; status: QuestStatus; shared: boolean },
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(questsCol(campaignId), {
    campaignId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    status: input.status,
    revealed: input.shared,
    order: 0,
    ownerUid: owner.uid,
    ownerName: owner.name,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/**
 * Change a quest. `milestone`: the change happened in play — the quest keeps
 * which session it was (« accomplie en séance 5 »).
 */
export function updateQuest(
  campaignId: string,
  questId: string,
  patch: Partial<QuestInput>,
  milestone?: QuestMilestone,
): Promise<void> {
  return updateDoc(doc(questsCol(campaignId), questId), {
    ...patch,
    ...(milestone ? { milestones: arrayUnion(stripUndefined(milestone)) } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary.trim() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export function deleteQuest(campaignId: string, questId: string): Promise<void> {
  return deleteDoc(doc(questsCol(campaignId), questId));
}

export function deleteQuests(campaignId: string): Promise<void> {
  return deleteAllDocs(questsCol(campaignId));
}

/** Firestore refuses `undefined` inside an array element. */
function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
