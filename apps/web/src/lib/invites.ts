import {
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
  writeBatch,
} from "firebase/firestore";
import {
  COLLECTIONS,
  campaignInviteSchema,
  type Campaign,
  type CampaignInvite,
  type UserProfile,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { parseDoc, subscribeCollection } from "@/lib/firestore";
import { tr } from "@/i18n";

/** Who is sending an invite: the campaign's GM. */
export interface InviteSender {
  uid: string;
  displayName: string | null;
  email: string | null;
}

/** Who is joining: the signed-in player. */
export interface Joiner {
  uid: string;
  displayName: string | null;
  email: string | null;
}

const invitesRef = () => collection(db, COLLECTIONS.invites);

function senderName(gm: InviteSender): string {
  return gm.displayName || gm.email || tr("common:gm");
}

/** The fields every invite snapshots from its campaign. */
function inviteBase(campaign: WithId<Campaign>, gm: InviteSender) {
  const now = serverTimestamp();
  return {
    status: "pending" as const,
    campaignId: campaign.id,
    campaignName: campaign.name,
    characterSystem: campaign.characterSystem,
    gmUid: gm.uid,
    gmName: senderName(gm),
    createdAt: now,
    updatedAt: now,
  };
}

/** Absolute URL of the join screen for an invite. */
export function inviteUrl(inviteId: string): string {
  return `${window.location.origin}/join/${inviteId}`;
}

/** Create a shareable link invite. Returns its id (the secret in the URL). */
export async function createInviteLink(
  campaign: WithId<Campaign>,
  gm: InviteSender,
): Promise<string> {
  const ref = doc(invitesRef());
  await setDoc(ref, { ...inviteBase(campaign, gm), kind: "link" });
  return ref.id;
}

export type EmailInviteResult = { ok: true; displayName: string } | { ok: false; reason: string };

/**
 * Invite an existing account by email. The player sees it in their
 * notifications and accepts (then picks a character) or declines.
 */
export async function inviteByEmail(
  campaign: WithId<Campaign>,
  gm: InviteSender,
  email: string,
): Promise<EmailInviteResult> {
  const normalized = email.trim().toLowerCase();
  const users = await getDocs(
    query(collection(db, COLLECTIONS.users), where("email", "==", normalized), limit(1)),
  );
  const found = users.docs[0];
  if (!found) {
    return {
      ok: false,
      reason: tr("common:invite.noAccount"),
    };
  }
  const profile = found.data() as UserProfile;
  const displayName = profile.displayName || profile.email;
  if (campaign.memberIds.includes(profile.uid)) {
    return { ok: false, reason: tr("common:invite.member", { name: displayName }) };
  }

  const pending = await getDocs(
    query(
      invitesRef(),
      where("gmUid", "==", gm.uid),
      where("campaignId", "==", campaign.id),
      where("invitedUid", "==", profile.uid),
      where("status", "==", "pending"),
      limit(1),
    ),
  );
  if (!pending.empty) {
    return { ok: false, reason: tr("common:invite.pending", { name: displayName }) };
  }

  await setDoc(doc(invitesRef()), {
    ...inviteBase(campaign, gm),
    kind: "email",
    invitedUid: profile.uid,
    invitedName: displayName,
  });
  return { ok: true, displayName };
}

export async function getInvite(id: string): Promise<WithId<CampaignInvite> | null> {
  const snapshot = await getDoc(doc(invitesRef(), id));
  if (!snapshot.exists()) return null;
  return parseDoc<CampaignInvite>(campaignInviteSchema, snapshot);
}

/** Every invite the GM sent for a campaign (links and emails, any status). */
export function subscribeCampaignInvites(
  campaignId: string,
  gmUid: string,
  onChange: (invites: WithId<CampaignInvite>[]) => void,
): () => void {
  return subscribeCollection<CampaignInvite>(
    query(invitesRef(), where("gmUid", "==", gmUid), where("campaignId", "==", campaignId)),
    onChange,
    { mapper: (d) => parseDoc<CampaignInvite>(campaignInviteSchema, d) },
  );
}

/** Email invites waiting for this player's answer — the notification feed. */
export function subscribeMyPendingInvites(
  uid: string,
  onChange: (invites: WithId<CampaignInvite>[]) => void,
): () => void {
  return subscribeCollection<CampaignInvite>(
    query(invitesRef(), where("invitedUid", "==", uid), where("status", "==", "pending")),
    onChange,
    { mapper: (d) => parseDoc<CampaignInvite>(campaignInviteSchema, d) },
  );
}

/** GM: a revoked link stops working; a revoked email invite leaves the player's feed. */
export async function revokeInvite(id: string): Promise<void> {
  await updateDoc(doc(invitesRef(), id), { status: "revoked", updatedAt: serverTimestamp() });
}

/** GM: forget an invite that is no longer pending. */
export async function deleteInvite(id: string): Promise<void> {
  await deleteDoc(doc(invitesRef(), id));
}

/** Player: turn an email invite down. */
export async function declineInvite(id: string): Promise<void> {
  const now = serverTimestamp();
  await updateDoc(doc(invitesRef(), id), { status: "declined", respondedAt: now, updatedAt: now });
}

/**
 * Player: join the invite's campaign with a character, in one batch — the
 * member doc (checked against the invite by the rules), the campaign's
 * `memberIds`, and for an email invite its `accepted` status.
 */
export async function joinCampaign(
  invite: WithId<CampaignInvite>,
  player: Joiner,
  characterId: string,
): Promise<void> {
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.campaigns, invite.campaignId, COLLECTIONS.members, player.uid), {
    uid: player.uid,
    role: "player",
    status: "active",
    displayName: player.displayName || player.email || "Joueur",
    inviteId: invite.id,
    characterId,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  batch.update(doc(db, COLLECTIONS.campaigns, invite.campaignId), {
    memberIds: arrayUnion(player.uid),
    updatedAt: now,
  });
  // The campaign's GM and members may now read the sheet.
  batch.update(doc(db, COLLECTIONS.characters, characterId), {
    campaignIds: arrayUnion(invite.campaignId),
  });
  if (invite.kind === "email") {
    batch.update(doc(invitesRef(), invite.id), {
      status: "accepted",
      respondedAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
}
