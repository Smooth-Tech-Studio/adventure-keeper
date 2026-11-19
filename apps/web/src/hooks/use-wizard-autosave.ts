import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/i18n";

/**
 * Keeps the guided creation alive across a reload.
 *
 * This is **not** the draft feature: a draft is an explicit, named save in
 * Firestore that follows the player from one device to the next. This is the
 * safety net for the accident — a refresh, a closed tab, a crash — and it never
 * leaves the browser.
 *
 * Nothing is restored behind the player's back: the hook reports what it found
 * and the wizard offers to pick it up. Everything is wrapped in try/catch, since
 * `localStorage` throws in a private window and comes back empty when site data
 * is cleared.
 */

const KEY = "ak:wizard-draft:v1";
const SAVE_DELAY_MS = 600;

export interface WizardSnapshot<T> {
  state: T;
  step: number;
  /** When it was written, so the offer can say how old it is. */
  savedAt: number;
}

function read<T>(): WizardSnapshot<T> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardSnapshot<T>;
    if (!parsed || typeof parsed.step !== "number" || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(snapshot: WizardSnapshot<T>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // A full or blocked store is not worth interrupting creation for.
  }
}

/** What a previous creation left on this device, without starting a new one. */
export function readWizardSnapshot<T>(): WizardSnapshot<T> | null {
  return read<T>();
}

/**
 * Writes the creation right away, past the debounce: a guest is about to leave
 * for the sign-up page and must find it there on the way back.
 */
export function saveWizardSnapshot<T>(state: T, step: number): void {
  write({ state, step, savedAt: Date.now() });
}

export function clearWizardSnapshot(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignored for the same reason.
  }
}

export interface WizardAutosave<T> {
  /** What was found at mount, or `null`. Stays put until taken or dismissed. */
  recovered: WizardSnapshot<T> | null;
  /** The player accepted — the snapshot is cleared and returned. */
  take: () => WizardSnapshot<T> | null;
  /** The player declined — the snapshot is dropped. */
  dismiss: () => void;
}

/**
 * Saves `state` and `step` under a debounce, and surfaces whatever was there
 * when the wizard mounted.
 *
 * `enabled` is false while resuming a stored draft: that sheet already lives in
 * Firestore, so a local copy would only compete with it.
 */
export function useWizardAutosave<T>(state: T, step: number, enabled = true): WizardAutosave<T> {
  // Read once, before the first save can overwrite it.
  const [recovered, setRecovered] = useState<WizardSnapshot<T> | null>(() =>
    enabled ? read<T>() : null,
  );
  // Skip the save the mount itself would trigger.
  const mounted = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(
      () => write({ state, step, savedAt: Date.now() }),
      SAVE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state, step, enabled]);

  const take = useCallback(() => {
    const snapshot = recovered;
    setRecovered(null);
    return snapshot;
  }, [recovered]);

  const dismiss = useCallback(() => {
    setRecovered(null);
    clearWizardSnapshot();
  }, []);

  return { recovered, take, dismiss };
}

/** `"il y a 3 min"`, for the recovery offer. */
export function describeAge(savedAt: number): string {
  const minutes = Math.round((Date.now() - savedAt) / 60_000);
  if (minutes < 1) return tr("common:age.now");
  if (minutes < 60) return tr("common:age.minutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tr("common:age.hours", { count: hours });
  return tr("common:age.days", { count: Math.round(hours / 24) });
}
