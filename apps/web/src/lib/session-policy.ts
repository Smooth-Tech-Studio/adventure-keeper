/**
 * How long a sign-in lasts. Firebase keeps a session until sign-out — its
 * refresh tokens do not expire — so the limits live here, on the device:
 *
 * - « Rester connecté » unticked: the session ends with the browser
 *   (Firebase's `browserSessionPersistence`); nothing more to check.
 * - ticked: it lasts at most {@link MAX_SESSION_DAYS} days after the
 *   sign-in, and ends sooner after {@link IDLE_DAYS} days without opening the app.
 *
 * Sensitive actions (password, e-mail, deleting the account) ask for the
 * password again anyway (`lib/account.ts`).
 */

export const MAX_SESSION_DAYS = 30;
export const IDLE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "ak-session";

export interface SessionStamp {
  /** When the user signed in on this device. */
  signedInAt: number;
  /** The last time the app was open. */
  lastSeenAt: number;
  /** « Rester connecté » was ticked. */
  remember: boolean;
}

export type SessionVerdict = "ok" | "expired" | "idle";

/** Whether a remembered session is still within its limits. Pure, for the tests. */
export function sessionVerdict(stamp: SessionStamp, now: number): SessionVerdict {
  if (!stamp.remember) return "ok";
  if (now - stamp.signedInAt > MAX_SESSION_DAYS * DAY_MS) return "expired";
  if (now - stamp.lastSeenAt > IDLE_DAYS * DAY_MS) return "idle";
  return "ok";
}

// Storage can be missing or refuse (private windows): the policy then simply
// does not apply, which is no worse than before it existed.

export function readStamp(): SessionStamp | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionStamp) : null;
  } catch {
    return null;
  }
}

export function writeStamp(stamp: SessionStamp): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamp));
  } catch {
    /* see above */
  }
}

export function clearStamp(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see above */
  }
}

/** Why the last session ended, for the sign-in page to say — read once. */
const ENDED_KEY = "ak-session-ended";

export function markSessionEnded(verdict: Exclude<SessionVerdict, "ok">): void {
  try {
    sessionStorage.setItem(ENDED_KEY, verdict);
  } catch {
    /* see above */
  }
}

export function takeSessionEnded(): Exclude<SessionVerdict, "ok"> | null {
  try {
    const value = sessionStorage.getItem(ENDED_KEY);
    sessionStorage.removeItem(ENDED_KEY);
    return value === "expired" || value === "idle" ? value : null;
  } catch {
    return null;
  }
}
