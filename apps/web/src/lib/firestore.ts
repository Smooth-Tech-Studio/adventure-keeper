import {
  getDocs,
  onSnapshot,
  writeBatch,
  type CollectionReference,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { ZodType } from "zod";
import type { WithId } from "@adventure-keeper/schemas";

/** `{ id, ...data }` from a Firestore document snapshot. */
export function mapDoc<T>(snapshot: QueryDocumentSnapshot): WithId<T> {
  return { id: snapshot.id, ...(snapshot.data() as T) };
}

/**
 * Like {@link mapDoc}, but runs the payload through a Zod schema first. The
 * parse is **non-fatal**: a mismatch is logged in dev (so a malformed doc is
 * visible) and the raw `{ id, ...data }` is still returned unchanged — a strict
 * parse would also reject the `serverTimestamp()` sentinels present on the local
 * echo of a just-written doc.
 */
export function parseDoc<T>(
  schema: ZodType<T>,
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): WithId<T> {
  return parseData(schema, snapshot.ref.path, { id: snapshot.id, ...(snapshot.data() ?? {}) });
}

/** `parseDoc` for data put together from several docs (a sheet and its belongings). */
export function parseData<T>(schema: ZodType<T>, path: string, data: object): WithId<T> {
  const raw = data as WithId<T>;
  const result = schema.safeParse(raw);
  if (!result.success && import.meta.env?.DEV) {
    console.warn(`[parseDoc] ${path} ne respecte pas le schéma`, result.error.issues);
  }
  return raw;
}

/** Milliseconds from a Firestore `Timestamp`-like value (0 if absent). */
export function toMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
}

/** Sort comparator: most recently updated first. */
export function byUpdatedAtDesc(a: { updatedAt?: unknown }, b: { updatedAt?: unknown }): number {
  return toMillis(b.updatedAt) - toMillis(a.updatedAt);
}

/**
 * Delete every document matched by a collection or query, in chunks that stay
 * under Firestore's 500-writes-per-batch cap. Does not recurse into the
 * documents' own subcollections — the Web SDK can't, so callers delete nested
 * collections explicitly before the parent.
 */
export async function deleteAllDocs(source: CollectionReference | Query): Promise<void> {
  const CHUNK = 450;
  const snapshot = await getDocs(source);
  for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
    const batch = writeBatch(source.firestore);
    for (const d of snapshot.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
}

/** Subscribe to a collection/query, mapping each doc to `{ id, ...data }`. */
export function subscribeCollection<T>(
  ref: CollectionReference | Query,
  onChange: (rows: WithId<T>[]) => void,
  options: {
    /** Per-document mapper (defaults to {@link mapDoc}) — pass a `parseDoc` binding to validate. */
    mapper?: (snapshot: QueryDocumentSnapshot) => WithId<T>;
    transform?: (rows: WithId<T>[]) => WithId<T>[];
  } = {},
): () => void {
  const { mapper = mapDoc<T>, transform } = options;
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map(mapper);
    onChange(transform ? transform(rows) : rows);
  });
}
