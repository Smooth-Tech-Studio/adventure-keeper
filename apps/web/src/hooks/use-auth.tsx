import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { COLLECTIONS, type UserProfile, type WithId } from "@adventure-keeper/schemas";

import i18n, { currentLanguage, isLanguage } from "@/i18n";
import { auth, db } from "@/lib/firebase";
import { syncProfileEmail } from "@/lib/account";
import {
  clearStamp,
  markSessionEnded,
  readStamp,
  sessionVerdict,
  writeStamp,
} from "@/lib/session-policy";
import { subscribeUserProfile } from "@/lib/users";

/** How often an open app re-checks its session limits. */
const SESSION_CHECK_MS = 60 * 60 * 1000;

interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
}

interface AuthContextValue {
  /** `undefined` while the initial auth state is loading, then `User | null`. */
  user: User | null;
  /**
   * The signed-in user's profile (`users/{uid}`), live: its name and avatar
   * are what the app shows, so an edit on the profile page is seen at once.
   */
  profile: WithId<UserProfile> | null;
  /** `true` until the profile's first read: `profile` is not yet known. */
  profileLoading: boolean;
  loading: boolean;
  /** `remember`: « Rester connecté » — else the session ends with the browser. */
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  /** Mail a password-reset link. Silent about unknown addresses. */
  resetPassword: (email: string) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WithId<UserProfile> | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  // Session limits (`lib/session-policy.ts`): checked on opening, then hourly
  // while the app stays open; each check also records that it was used.
  useEffect(() => {
    if (!user) return;
    function check() {
      const now = Date.now();
      const stamp = readStamp();
      if (!stamp) {
        // Signed in before the policy existed: its clock starts now.
        writeStamp({ signedInAt: now, lastSeenAt: now, remember: true });
        return;
      }
      const verdict = sessionVerdict(stamp, now);
      if (verdict !== "ok") {
        markSessionEnded(verdict);
        clearStamp();
        void signOut(auth);
        return;
      }
      writeStamp({ ...stamp, lastSeenAt: now });
    }
    check();
    const timer = window.setInterval(check, SESSION_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    return subscribeUserProfile(user.uid, (next) => {
      setProfile(next);
      setProfileLoading(false);
    });
  }, [user]);

  // The profile's language wins over this device's: set on another device, it
  // applies here too.
  const profileLocale = profile?.locale;
  useEffect(() => {
    if (isLanguage(profileLocale) && profileLocale !== currentLanguage()) {
      void i18n.changeLanguage(profileLocale);
    }
  }, [profileLocale]);

  // Firebase's own mails (password reset, e-mail change) follow the interface.
  useEffect(() => {
    auth.languageCode = currentLanguage();
    const follow = () => {
      auth.languageCode = currentLanguage();
    };
    i18n.on("languageChanged", follow);
    return () => i18n.off("languageChanged", follow);
  }, []);

  // A confirmed e-mail change: the profile copy follows the account.
  useEffect(() => {
    if (user && profile) void syncProfileEmail(user, profile.email).catch(console.error);
  }, [user, profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      profileLoading,
      loading,
      async signIn(email, password, remember = false) {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        // Stamped before signing in: the session check runs as soon as the
        // user appears, and must not judge this sign-in by an older stamp.
        const now = Date.now();
        writeStamp({ signedInAt: now, lastSeenAt: now, remember });
        await signInWithEmailAndPassword(auth, email, password);
      },
      async resetPassword(email) {
        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (error) {
          // Saying « no such account » would tell anyone which addresses are signed up.
          if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
        }
      },
      async signUp({ email, password, displayName }) {
        // A new account starts like an unticked « Rester connecté ».
        await setPersistence(auth, browserSessionPersistence);
        const now = Date.now();
        writeStamp({ signedInAt: now, lastSeenAt: now, remember: false });
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });
        // Mirror the account into `users/{uid}` (see packages/schemas → userProfileSchema).
        await setDoc(doc(db, COLLECTIONS.users, credential.user.uid), {
          uid: credential.user.uid,
          email,
          displayName,
          locale: currentLanguage(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      },
      async logout() {
        clearStamp();
        await signOut(auth);
      },
    }),
    [user, profile, profileLoading, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
