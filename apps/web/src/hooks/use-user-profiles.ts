import { useEffect, useState } from "react";
import type { UserProfile, WithId } from "@adventure-keeper/schemas";

import { useAuth } from "@/hooks/use-auth";
import { readUserProfile } from "@/lib/users";

export type ProfilesByUid = Record<string, WithId<UserProfile>>;

/**
 * The profiles of the given users, keyed by uid — to show their **current**
 * name and avatar where an older copy was stored (a campaign member, a pack's
 * owner, an invite's GM). Yours is the live one from the auth context.
 */
export function useUserProfiles(uids: readonly (string | undefined)[]): ProfilesByUid {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<ProfilesByUid>({});
  const key = [...new Set(uids.filter((uid): uid is string => Boolean(uid)))].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(",").map(readUserProfile)).then((found) => {
      if (cancelled) return;
      setProfiles(
        Object.fromEntries(found.flatMap((entry) => (entry ? [[entry.uid, entry] as const] : []))),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return profile ? { ...profiles, [profile.uid]: profile } : profiles;
}

/** The current name of a user, else the copy stored with the record. */
export function nameOf(profiles: ProfilesByUid, uid: string | undefined, stored: string): string {
  return (uid && profiles[uid]?.displayName) || stored;
}
