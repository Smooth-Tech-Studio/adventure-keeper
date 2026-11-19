import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS, type Campaign, type WithId } from "@adventure-keeper/schemas";

import { listMyCampaigns } from "@/lib/campaigns";
import { deleteCharacter } from "@/lib/characters";
import { db } from "@/lib/firebase";
import { deletePack, leaveSharedPack } from "@/systems/dnd2024/lib/packs";
import { tr } from "@/i18n";

/**
 * The account itself: password, e-mail, deletion. Each asks for the current
 * password first — Firebase only lets a recent sign-in do these, and it keeps
 * a forgotten open session from being turned against its owner.
 */

async function confirmPassword(user: User, password: string): Promise<void> {
  if (!user.email) throw new Error(tr("common:noEmail"));
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await confirmPassword(user, currentPassword);
  await updatePassword(user, newPassword);
}

/**
 * Ask to move the account to `newEmail`. Firebase mails a link there; the
 * address changes once it is followed — until then, the old one still signs
 * in. The profile copy follows at the next sign-in (`syncProfileEmail`).
 */
export async function requestEmailChange(
  user: User,
  currentPassword: string,
  newEmail: string,
): Promise<void> {
  await confirmPassword(user, currentPassword);
  await verifyBeforeUpdateEmail(user, newEmail.trim());
}

/**
 * Keep the profile's e-mail — what an invitation by e-mail looks up — equal to
 * the account's, once a change has been confirmed.
 */
export async function syncProfileEmail(user: User, profileEmail: string | undefined) {
  if (!user.email || user.email === profileEmail) return;
  await setDoc(
    doc(db, COLLECTIONS.users, user.uid),
    { email: user.email, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** The campaigns a user runs: an account cannot go while it is their GM. */
export async function campaignsIRun(uid: string): Promise<WithId<Campaign>[]> {
  return (await listMyCampaigns(uid)).filter((campaign) => campaign.ownerId === uid);
}

/**
 * Delete the account and what belongs to it: characters and drafts, the packs
 * one owns, one's place in campaigns and in packs shared with one, the
 * profile, then the sign-in itself — last, while the rules still know who
 * asks. Refused while the user is GM of a campaign (`campaignsIRun`). Packs a
 * campaign copied stay with the campaign, as when a pack is deleted.
 */
export async function deleteMyAccount(user: User, currentPassword: string): Promise<void> {
  await confirmPassword(user, currentPassword);
  const uid = user.uid;

  const running = await campaignsIRun(uid);
  if (running.length > 0) throw new Error("STILL_GM");

  // Leave each campaign: off the member list, then the member doc.
  for (const campaign of await listMyCampaigns(uid)) {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.campaigns, campaign.id), {
      memberIds: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, COLLECTIONS.campaigns, campaign.id, COLLECTIONS.members, uid));
    await batch.commit();
  }

  const mine = (name: string, field: string) =>
    getDocs(query(collection(db, name), where(field, "==", uid)));
  for (const character of (await mine(COLLECTIONS.characters, "ownerId")).docs) {
    await deleteCharacter(character.id);
  }
  for (const pack of (await mine(COLLECTIONS.contentPacks, "ownerId")).docs) {
    await deletePack(pack.id);
  }
  const sharedWithMe = await getDocs(
    query(collection(db, COLLECTIONS.contentPacks), where("sharedWith", "array-contains", uid)),
  );
  for (const pack of sharedWithMe.docs) await leaveSharedPack(pack.id, uid);

  await deleteDoc(doc(db, COLLECTIONS.users, uid));
  await deleteUser(user);
}
