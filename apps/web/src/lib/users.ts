import { updateProfile, type User } from "firebase/auth";
import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  COLLECTIONS,
  userProfileSchema,
  type ImageCrop,
  type UserProfile,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { parseDoc } from "@/lib/firestore";

const profileRef = (uid: string) => doc(db, COLLECTIONS.users, uid);

/** A user's profile, live — `null` while missing (an account created before profiles). */
export function subscribeUserProfile(
  uid: string,
  onChange: (profile: WithId<UserProfile> | null) => void,
): () => void {
  return onSnapshot(profileRef(uid), (snapshot) =>
    onChange(snapshot.exists() ? parseDoc<UserProfile>(userProfileSchema, snapshot) : null),
  );
}

export interface ProfileEdit {
  displayName: string;
  photoURL?: string;
  photoCrop?: ImageCrop;
  bio: string;
}

/**
 * Save one's own profile. The name and the avatar also go to the Firebase
 * Auth account, which other parts of the app (invites, new campaigns) read.
 */
export async function updateMyProfile(user: User, edit: ProfileEdit): Promise<void> {
  const bio = edit.bio.trim();
  // Merged rather than updated: an account older than profiles has no doc yet.
  await setDoc(
    profileRef(user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: edit.displayName.trim(),
      photoURL: edit.photoURL ?? deleteField(),
      photoCrop: edit.photoURL && edit.photoCrop ? edit.photoCrop : deleteField(),
      bio: bio || deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateProfile(user, {
    displayName: edit.displayName.trim(),
    photoURL: edit.photoURL ?? null,
  });
}

/** Save one's interface language — merged, like the rest of the profile. */
export async function updateMyLocale(uid: string, locale: string): Promise<void> {
  await setDoc(profileRef(uid), { locale, updatedAt: serverTimestamp() }, { merge: true });
}

const profileReads = new Map<string, Promise<WithId<UserProfile> | null>>();

/**
 * A user's profile, read once per page load: names and avatars of the others
 * do not need to be live, and a campaign screen asks for the same members
 * again and again.
 */
export function readUserProfile(uid: string): Promise<WithId<UserProfile> | null> {
  let read = profileReads.get(uid);
  if (!read) {
    read = getDoc(profileRef(uid))
      .then((snapshot) =>
        snapshot.exists() ? parseDoc<UserProfile>(userProfileSchema, snapshot) : null,
      )
      .catch(() => null);
    profileReads.set(uid, read);
  }
  return read;
}
