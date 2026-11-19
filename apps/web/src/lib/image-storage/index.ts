import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { COLLECTIONS } from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { dropboxAppKey, uploadToDropbox } from "@/lib/image-storage/dropbox";
import type { StorageConnection } from "@/lib/image-storage/types";

export type { StorageConnection, StorageProvider } from "@/lib/image-storage/types";

/** Images bigger than this are refused before upload (a map is rarely above 10 Mo). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** `true` when this deployment can connect an image store (the app key is set). */
export const imageStorageAvailable = (): boolean => Boolean(dropboxAppKey());

/** `users/{uid}/private/storage` — only its owner reads or writes it. */
const connectionRef = (uid: string) => doc(db, COLLECTIONS.users, uid, "private", "storage");

export function subscribeStorageConnection(
  uid: string,
  onChange: (connection: StorageConnection | null) => void,
): () => void {
  return onSnapshot(
    connectionRef(uid),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as StorageConnection) : null),
    () => onChange(null),
  );
}

export async function saveStorageConnection(
  uid: string,
  connection: StorageConnection,
): Promise<void> {
  await setDoc(connectionRef(uid), connection);
}

export async function removeStorageConnection(uid: string): Promise<void> {
  await deleteDoc(connectionRef(uid));
}

/** Why an image cannot be imported, or `null` when it can. */
export function imageFileProblem(file: File): "notImage" | "tooBig" | null {
  if (!file.type.startsWith("image/")) return "notImage";
  if (file.size > MAX_IMAGE_BYTES) return "tooBig";
  return null;
}

/**
 * Upload an image to the player's store and return its public direct link.
 * A refreshed token is saved back, so the next upload does not refresh again.
 */
export async function uploadImage(
  uid: string,
  connection: StorageConnection,
  file: File,
): Promise<string> {
  const { url, connection: fresh } = await uploadToDropbox(connection, file);
  if (fresh.accessToken !== connection.accessToken) await saveStorageConnection(uid, fresh);
  return url;
}
