import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  COLLECTIONS,
  CONTENT_PACK_MAX_BYTES,
  campaignPackSchema,
  contentPackDocSchema,
  type CampaignPack,
  type ContentPackDoc,
  type UserProfile,
  type WithId,
} from "@adventure-keeper/schemas";
import {
  PACK_CONTENT_KINDS,
  contentPackToJson,
  createContentOverlay,
  parseContentPackJson,
  type ContentOverlay,
  type ContentPack,
} from "@adventure-keeper/system-dnd2024";

import { db } from "@/lib/firebase";
import { parseDoc, subscribeCollection } from "@/lib/firestore";
import { tr } from "@/i18n";

/** Who owns or activates a pack: the signed-in user. */
export interface PackUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

const packsRef = () => collection(db, COLLECTIONS.contentPacks);
const campaignPacksRef = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.campaignPacks);

function userName(user: PackUser): string {
  return user.displayName || user.email || "Joueur";
}

function entryCount(pack: ContentPack): number {
  return PACK_CONTENT_KINDS.reduce((sum, kind) => sum + pack.content[kind].length, 0);
}

const toPackDoc = (d: Parameters<typeof parseDoc>[1]) =>
  parseDoc<ContentPackDoc>(contentPackDocSchema, d);

// --- Library --------------------------------------------------------------------

export type ImportPackResult =
  | { ok: true; id: string }
  | { ok: false; errors: string[] }
  /** The owner already has a pack with this id — offer to replace it. */
  | { ok: false; conflictId: string; errors: string[] };

/**
 * Validate a pack file and check it fits in a Firestore document — the import's
 * own check, also offered on its own by the format guide (« Vérifier un fichier »).
 */
export function checkPackFile(
  json: string,
): { ok: true; pack: ContentPack } | { ok: false; errors: string[] } {
  const parsed = parseContentPackJson(json);
  if (!parsed.ok) return parsed;
  if (new TextEncoder().encode(contentPackToJson(parsed.pack)).length > CONTENT_PACK_MAX_BYTES) {
    return {
      ok: false,
      errors: [tr("packs:errors.tooBig")],
    };
  }
  return parsed;
}

async function findMyPack(ownerId: string, packId: string): Promise<string | undefined> {
  const snapshot = await getDocs(
    query(packsRef(), where("ownerId", "==", ownerId), where("packId", "==", packId), limit(1)),
  );
  return snapshot.docs[0]?.id;
}

/** Add a pack file (its text) to the owner's library. */
export async function importPack(json: string, owner: PackUser): Promise<ImportPackResult> {
  const read = checkPackFile(json);
  if (!read.ok) return read;
  const { pack } = read;

  const existing = await findMyPack(owner.uid, pack.id);
  if (existing) {
    return {
      ok: false,
      conflictId: existing,
      errors: [tr("packs:errors.duplicate", { id: pack.id })],
    };
  }

  const ref = doc(packsRef());
  const now = serverTimestamp();
  await setDoc(ref, {
    ownerId: owner.uid,
    ownerName: userName(owner),
    packId: pack.id,
    name: pack.name,
    version: pack.version,
    entryCount: entryCount(pack),
    pack,
    sharedWith: [],
    linkSharing: false,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, id: ref.id };
}

/**
 * Replace a library pack with a new version of the same pack. Its id must not
 * change: characters and campaigns refer to its entries as `"<id>:<entry>"`.
 */
export async function replacePack(
  docId: string,
  json: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const read = checkPackFile(json);
  if (!read.ok) return read;
  const current = await getPack(docId);
  if (!current) return { ok: false, errors: [tr("packs:errors.gone")] };
  if (current.packId !== read.pack.id) {
    return {
      ok: false,
      errors: [tr("packs:errors.idChanged", { current: current.packId, file: read.pack.id })],
    };
  }
  await updateDoc(doc(packsRef(), docId), {
    name: read.pack.name,
    version: read.pack.version,
    entryCount: entryCount(read.pack),
    pack: read.pack,
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function getPack(docId: string): Promise<WithId<ContentPackDoc> | null> {
  const snapshot = await getDoc(doc(packsRef(), docId));
  return snapshot.exists() ? toPackDoc(snapshot) : null;
}

/** The owner's packs, live. */
export function subscribeMyPacks(
  uid: string,
  onChange: (packs: WithId<ContentPackDoc>[]) => void,
): () => void {
  return subscribeCollection<ContentPackDoc>(
    query(packsRef(), where("ownerId", "==", uid)),
    onChange,
    {
      mapper: toPackDoc,
    },
  );
}

/** Packs other players shared with this account, live. */
export function subscribePacksSharedWithMe(
  uid: string,
  onChange: (packs: WithId<ContentPackDoc>[]) => void,
): () => void {
  return subscribeCollection<ContentPackDoc>(
    query(packsRef(), where("sharedWith", "array-contains", uid)),
    onChange,
    { mapper: toPackDoc },
  );
}

export async function deletePack(docId: string): Promise<void> {
  await deleteDoc(doc(packsRef(), docId));
}

/** The pack file, as the owner or a sharee would download it. */
export function packFileName(pack: Pick<ContentPackDoc, "packId" | "version">): string {
  return `${pack.packId}-${pack.version}.json`;
}

// --- Sharing --------------------------------------------------------------------

/** Absolute URL that lets anyone signed in add the pack to their library. */
export function packShareUrl(docId: string): string {
  return `${window.location.origin}/packs/shared/${docId}`;
}

export async function setPackLinkSharing(docId: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(packsRef(), docId), { linkSharing: enabled, updatedAt: serverTimestamp() });
}

export type SharePackResult = { ok: true; displayName: string } | { ok: false; reason: string };

/** Owner: share with an existing account, found by email. */
export async function sharePackByEmail(
  pack: WithId<ContentPackDoc>,
  email: string,
): Promise<SharePackResult> {
  const users = await getDocs(
    query(
      collection(db, COLLECTIONS.users),
      where("email", "==", email.trim().toLowerCase()),
      limit(1),
    ),
  );
  const found = users.docs[0];
  if (!found) return { ok: false, reason: tr("packs:errors.noAccount") };
  const profile = found.data() as UserProfile;
  const displayName = profile.displayName || profile.email;
  if (profile.uid === pack.ownerId) return { ok: false, reason: tr("packs:errors.ownPack") };
  if (pack.sharedWith.includes(profile.uid)) {
    return { ok: false, reason: tr("packs:errors.alreadyShared", { name: displayName }) };
  }
  await updateDoc(doc(packsRef(), pack.id), {
    sharedWith: arrayUnion(profile.uid),
    updatedAt: serverTimestamp(),
  });
  return { ok: true, displayName };
}

/** Owner: take access away. */
export async function unsharePack(docId: string, uid: string): Promise<void> {
  await updateDoc(doc(packsRef(), docId), {
    sharedWith: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

/** Anyone with the link: add the pack to one's own library. */
export async function addSharedPackToLibrary(docId: string, uid: string): Promise<void> {
  await updateDoc(doc(packsRef(), docId), { sharedWith: arrayUnion(uid) });
}

/** Sharee: remove a shared pack from one's library. */
export async function leaveSharedPack(docId: string, uid: string): Promise<void> {
  await updateDoc(doc(packsRef(), docId), { sharedWith: arrayRemove(uid) });
}

// --- Campaigns ------------------------------------------------------------------

export type ActivatePackResult = { ok: true } | { ok: false; reason: string };

/**
 * GM: allow a library pack in a campaign by copying it there. Activating it
 * again refreshes the copy. Refused when another pack already uses the same
 * id in this campaign — their entries would collide.
 */
export async function activatePackInCampaign(
  campaignId: string,
  pack: WithId<ContentPackDoc>,
  gm: PackUser,
): Promise<ActivatePackResult> {
  const ref = doc(campaignPacksRef(campaignId), pack.packId);
  const current = await getDoc(ref);
  if (current.exists() && (current.data() as CampaignPack).sourceId !== pack.id) {
    const other = current.data() as CampaignPack;
    return {
      ok: false,
      reason: tr("packs:errors.idTaken", {
        name: other.name,
        owner: other.ownerName,
        id: pack.packId,
      }),
    };
  }
  const now = serverTimestamp();
  await setDoc(ref, {
    sourceId: pack.id,
    ownerId: pack.ownerId,
    ownerName: pack.ownerName,
    packId: pack.packId,
    name: pack.name,
    version: pack.version,
    pack: pack.pack,
    activatedBy: gm.uid,
    createdAt: current.exists() ? (current.data() as CampaignPack).createdAt : now,
    updatedAt: now,
  });
  return { ok: true };
}

/** GM: stop allowing a pack. Characters keep their own copy of what they use. */
export async function deactivatePackInCampaign(campaignId: string, packId: string): Promise<void> {
  await deleteDoc(doc(campaignPacksRef(campaignId), packId));
}

/** The packs allowed in a campaign, read once (the campaign file export). */
export async function listCampaignPacks(campaignId: string): Promise<WithId<CampaignPack>[]> {
  const snapshot = await getDocs(campaignPacksRef(campaignId));
  return snapshot.docs.map((d) => parseDoc<CampaignPack>(campaignPackSchema, d));
}

/** The packs allowed in a campaign, live. */
export function subscribeCampaignPacks(
  campaignId: string,
  onChange: (packs: WithId<CampaignPack>[]) => void,
): () => void {
  return subscribeCollection<CampaignPack>(campaignPacksRef(campaignId), onChange, {
    mapper: (d) => parseDoc<CampaignPack>(campaignPackSchema, d),
  });
}

/** One content overlay for a set of packs — SRD-only (`null`) when there are none. */
export function overlayFor(packs: readonly ContentPack[]): ContentOverlay | null {
  return packs.length ? createContentOverlay(packs) : null;
}
