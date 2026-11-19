import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Query,
} from "firebase/firestore";
import {
  COLLECTIONS,
  codexEntryGmSchema,
  codexEntrySchema,
  codexLocationEntryId,
  type AdventureNpc,
  type CodexEntry,
  type CodexEntryGm,
  type CodexKind,
  type ShownDocument,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { deleteAllDocs, parseDoc } from "@/lib/firestore";

const PRIVATE = "private";
const GM_DOC = "gm";

const codexCol = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.codex);
const entryDoc = (campaignId: string, entryId: string) => doc(codexCol(campaignId), entryId);
const gmDoc = (campaignId: string, entryId: string) =>
  doc(entryDoc(campaignId, entryId), PRIVATE, GM_DOC);

const byName = (a: CodexEntry, b: CodexEntry) => a.name.localeCompare(b.name);

/** The GM reads every entry; a player only the revealed ones (the rules demand the filter). */
function codexSource(campaignId: string, isGm: boolean): Query {
  return isGm ? codexCol(campaignId) : query(codexCol(campaignId), where("revealed", "==", true));
}

export function subscribeCodex(
  campaignId: string,
  isGm: boolean,
  onChange: (entries: WithId<CodexEntry>[]) => void,
): () => void {
  return onSnapshot(codexSource(campaignId, isGm), (snapshot) => {
    onChange(snapshot.docs.map((d) => parseDoc<CodexEntry>(codexEntrySchema, d)).sort(byName));
  });
}

export async function listCodex(campaignId: string, isGm: boolean): Promise<WithId<CodexEntry>[]> {
  const snapshot = await getDocs(codexSource(campaignId, isGm));
  return snapshot.docs.map((d) => parseDoc<CodexEntry>(codexEntrySchema, d)).sort(byName);
}

export async function getCodexSecret(campaignId: string, entryId: string): Promise<string> {
  const snapshot = await getDoc(gmDoc(campaignId, entryId));
  return snapshot.exists()
    ? (parseDoc<CodexEntryGm>(codexEntryGmSchema, snapshot).secret ?? "")
    : "";
}

export interface CodexInput {
  kind: CodexKind;
  name: string;
  summary: string;
  imageUrl: string;
  url: string;
  secret: string;
}

export const emptyCodexInput = (kind: CodexKind = "npc"): CodexInput => ({
  kind,
  name: "",
  summary: "",
  imageUrl: "",
  url: "",
  secret: "",
});

async function saveSecret(campaignId: string, entryId: string, secret: string): Promise<void> {
  const now = serverTimestamp();
  await setDoc(
    gmDoc(campaignId, entryId),
    { secret: secret.trim() || deleteField(), updatedAt: now, createdAt: now },
    { merge: true },
  );
}

export async function addCodexEntry(
  campaignId: string,
  input: CodexInput,
  extra: Partial<Pick<CodexEntry, "adventureId" | "sourceNpcId" | "revealed">> = {},
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(codexCol(campaignId), {
    campaignId,
    kind: input.kind,
    name: input.name.trim(),
    summary: input.summary.trim(),
    ...(input.imageUrl.trim() ? { imageUrl: input.imageUrl.trim() } : {}),
    ...(input.url.trim() ? { url: input.url.trim() } : {}),
    revealed: false,
    ...extra,
    createdAt: now,
    updatedAt: now,
  });
  if (input.secret.trim()) await saveSecret(campaignId, ref.id, input.secret);
  return ref.id;
}

export async function updateCodexEntry(
  campaignId: string,
  entryId: string,
  input: CodexInput,
): Promise<void> {
  await updateDoc(entryDoc(campaignId, entryId), {
    kind: input.kind,
    name: input.name.trim(),
    summary: input.summary.trim(),
    imageUrl: input.imageUrl.trim() || deleteField(),
    url: input.url.trim() || deleteField(),
    updatedAt: serverTimestamp(),
  });
  await saveSecret(campaignId, entryId, input.secret);
}

export async function deleteCodexEntry(campaignId: string, entryId: string): Promise<void> {
  await deleteDoc(gmDoc(campaignId, entryId));
  await deleteDoc(entryDoc(campaignId, entryId));
}

/** Every codex entry with its secret, for a campaign being deleted. */
export async function deleteCodex(campaignId: string): Promise<void> {
  const snapshot = await getDocs(codexCol(campaignId));
  await Promise.all(snapshot.docs.map((d) => deleteAllDocs(collection(d.ref, PRIVATE))));
  await deleteAllDocs(codexCol(campaignId));
}

export async function setCodexRevealed(
  campaignId: string,
  entryId: string,
  revealed: boolean,
): Promise<void> {
  await updateDoc(entryDoc(campaignId, entryId), {
    revealed,
    revealedAt: revealed ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** A faction's attitude toward the party, or none. */
export async function setCodexReputation(
  campaignId: string,
  entryId: string,
  reputation: number | null,
): Promise<void> {
  await updateDoc(entryDoc(campaignId, entryId), {
    reputation: reputation ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * A location the GM shows in a session becomes known: its codex entry is
 * created (or revealed again) — never overwriting what the GM wrote. A hidden
 * location's map is not copied: the fog may still cover most of it.
 */
export async function revealLocationInCodex(
  campaignId: string,
  adventureId: string,
  location: { id: string; name: string; imageUrl?: string; hidden?: boolean },
): Promise<void> {
  const ref = entryDoc(campaignId, codexLocationEntryId(location.id));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    const now = serverTimestamp();
    if (current.exists()) {
      if (current.data().revealed !== true) {
        tx.update(ref, { revealed: true, revealedAt: now, updatedAt: now });
      }
      return;
    }
    tx.set(ref, {
      campaignId,
      kind: "place" satisfies CodexKind,
      name: location.name,
      summary: "",
      ...(location.imageUrl && !location.hidden ? { imageUrl: location.imageUrl } : {}),
      revealed: true,
      revealedAt: now,
      adventureId,
      sourceLocationId: location.id,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Put an adventure NPC in the codex, still hidden: the name for the players,
 * the NPC's lore as the GM's secret. Returns the existing entry if any.
 */
export async function addNpcToCodex(
  campaignId: string,
  adventureId: string,
  npc: WithId<AdventureNpc>,
): Promise<{ id: string; created: boolean }> {
  const existing = await getDocs(query(codexCol(campaignId), where("sourceNpcId", "==", npc.id)));
  if (!existing.empty) return { id: existing.docs[0]!.id, created: false };
  const id = await addCodexEntry(
    campaignId,
    {
      kind: "npc",
      name: npc.name,
      summary: "",
      imageUrl: "",
      url: "",
      secret: [npc.personality, npc.lore].filter(Boolean).join("\n\n"),
    },
    { adventureId, sourceNpcId: npc.id },
  );
  return { id, created: true };
}

// --- Handouts in a live session --------------------------------------------

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

function snapshotOf(entry: WithId<CodexEntry>): ShownDocument {
  return {
    entryId: entry.id,
    name: entry.name,
    ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    ...(entry.url ? { url: entry.url } : {}),
  };
}

/**
 * Show a handout on every screen of the session. It is revealed in the codex
 * and recorded on the session, for the chronicle.
 */
export async function showDocument(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  entry: WithId<CodexEntry>,
): Promise<void> {
  const ref = sessionRef(campaignId, adventureId, sessionId);
  await runTransaction(db, async (tx) => {
    const session = await tx.get(ref);
    // Where it was found: the place on screen as it is handed out.
    const locationId = session.data()?.currentLocationId as string | undefined;
    const location = locationId
      ? await tx.get(
          doc(
            db,
            COLLECTIONS.campaigns,
            campaignId,
            COLLECTIONS.adventures,
            adventureId,
            COLLECTIONS.locations,
            locationId,
          ),
        )
      : null;
    const foundAt = location?.data()?.name as string | undefined;
    const shown = { ...snapshotOf(entry), ...(foundAt ? { foundAt } : {}) };
    const history = ((session.data()?.shownDocuments ?? []) as ShownDocument[]).filter(
      (d) => d.entryId !== entry.id,
    );
    tx.update(ref, {
      shownDocument: shown,
      shownDocuments: [...history, shown],
      updatedAt: serverTimestamp(),
    });
    tx.update(entryDoc(campaignId, entry.id), {
      revealed: true,
      ...(entry.revealed ? {} : { revealedAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Stop showing the handout (it stays revealed and in the session's history). */
export async function hideShownDocument(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): Promise<void> {
  await updateDoc(sessionRef(campaignId, adventureId, sessionId), {
    shownDocument: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
