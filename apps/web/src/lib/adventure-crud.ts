import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { ZodType } from "zod";
import { COLLECTIONS } from "@adventure-keeper/schemas";
import type { WithId } from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { mapDoc, parseDoc, subscribeCollection } from "@/lib/firestore";

/** `campaigns/{campaignId}/adventures/{adventureId}/{segment}` collection ref. */
export const adventureCollectionRef = (
  campaignId: string,
  adventureId: string,
  segment: string,
): CollectionReference =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.adventures, adventureId, segment);

/**
 * CRUD boilerplate shared by every adventure sub-collection. Each entity module
 * (`adventure-locations`, `adventure-enemies`, `adventure-npcs`…) wires this up
 * with its `segment` and layers its own field-shaping `add` / `update` on top of
 * the primitives returned here.
 */
export function adventureSubCollection<T>(
  segment: string,
  options: {
    ordered?: boolean;
    /** When given, reads run through {@link parseDoc} (non-fatal Zod check) instead of {@link mapDoc}. */
    schema?: ZodType<T>;
  } = {},
) {
  const col = (campaignId: string, adventureId: string) =>
    adventureCollectionRef(campaignId, adventureId, segment);

  const ref = (campaignId: string, adventureId: string, id: string) =>
    doc(col(campaignId, adventureId), id);

  const listSource = (campaignId: string, adventureId: string) =>
    options.ordered
      ? query(col(campaignId, adventureId), orderBy("order", "asc"))
      : col(campaignId, adventureId);

  const toRow = (snapshot: QueryDocumentSnapshot): WithId<T> =>
    options.schema ? parseDoc<T>(options.schema, snapshot) : mapDoc<T>(snapshot);

  return {
    col,
    ref,

    /** One-shot fetch mapped to `{ id, ...data }` (order-sorted when `ordered`). */
    async list(campaignId: string, adventureId: string): Promise<WithId<T>[]> {
      const snapshot = await getDocs(listSource(campaignId, adventureId));
      return snapshot.docs.map(toRow);
    },

    /** Live listener with the same mapping / sort as {@link list}. */
    subscribe(
      campaignId: string,
      adventureId: string,
      onChange: (rows: WithId<T>[]) => void,
    ): () => void {
      return subscribeCollection<T>(listSource(campaignId, adventureId), onChange, {
        mapper: toRow,
      });
    },

    /** Delete one document (no subcollection recursion). */
    remove(campaignId: string, adventureId: string, id: string): Promise<void> {
      return deleteDoc(ref(campaignId, adventureId, id));
    },

    /** Current document count — the default `order` for a freshly appended row. */
    async nextOrder(campaignId: string, adventureId: string): Promise<number> {
      return (await getDocs(col(campaignId, adventureId))).size;
    },

    /** `addDoc` with `campaignId` / `adventureId` / `createdAt` / `updatedAt` folded in. */
    async add(campaignId: string, adventureId: string, data: DocumentData): Promise<string> {
      const now = serverTimestamp();
      const created = await addDoc(col(campaignId, adventureId), {
        campaignId,
        adventureId,
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      return created.id;
    },

    /** `updateDoc` with a fresh `updatedAt` appended. */
    patch(
      campaignId: string,
      adventureId: string,
      id: string,
      fields: DocumentData,
    ): Promise<void> {
      return updateDoc(ref(campaignId, adventureId, id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    },
  };
}
