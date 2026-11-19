import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  COLLECTIONS,
  noteSchema,
  type Note,
  type NoteVisibility,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { parseDoc, toMillis } from "@/lib/firestore";

const notesCol = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.notes);

export interface CreateNoteInput {
  title: string;
  body?: string;
  visibility: NoteVisibility;
}

function sortNotes(notes: WithId<Note>[]): WithId<Note>[] {
  return [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return toMillis(b.updatedAt) - toMillis(a.updatedAt);
  });
}

/** Live notes list (the GM's notebook — GM-only per the rules). */
export function subscribeNotes(
  campaignId: string,
  onChange: (notes: WithId<Note>[]) => void,
): () => void {
  return onSnapshot(notesCol(campaignId), (snap) => {
    onChange(sortNotes(snap.docs.map((d) => parseDoc<Note>(noteSchema, d))));
  });
}

export async function createNote(
  campaignId: string,
  input: CreateNoteInput,
  authorId: string,
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(notesCol(campaignId), {
    campaignId,
    authorId,
    title: input.title.trim(),
    body: input.body?.trim() ?? "",
    visibility: input.visibility,
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateNote(
  campaignId: string,
  noteId: string,
  patch: Partial<Pick<Note, "title" | "body" | "visibility" | "pinned" | "tags">>,
): Promise<void> {
  await updateDoc(doc(notesCol(campaignId), noteId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(campaignId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(notesCol(campaignId), noteId));
}
