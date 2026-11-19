import { useCallback, useEffect, useRef, useState } from "react";

import {
  SessionTabRegistry,
  tabLockName,
  tabsFromLockNames,
  type SessionTabView,
} from "@/lib/session-tabs";

/** How often the open tabs are read (ms) — a "changed" ping speeds it up. */
const POLL_MS = 1_000;

export interface SessionTabs {
  /** What the other open tabs of this session show (same browser, same user). */
  others: ReadonlySet<SessionTabView>;
  /** `others` has been read at least once. */
  settled: boolean;
  /** Read at close time: is another tab still open (so closing this one isn't leaving)? */
  hasOpenTabs: () => boolean;
}

const EMPTY: ReadonlySet<SessionTabView> = new Set();

function sameViews(a: ReadonlySet<SessionTabView>, b: ReadonlySet<SessionTabView>) {
  return a.size === b.size && [...a].every((view) => b.has(view));
}

/**
 * Lets the tabs of one live session know about each other. Each tab holds a
 * Web Lock named after what it shows for as long as it's open; the others read
 * the held locks. The browser drops a lock with its tab — closed, refreshed or
 * crashed — so nothing relies on a "bye" that may never be sent. The main view
 * hides a block that's open in another tab; a detached tab knows when the
 * main view is gone. Same browser only: a phone and a laptop never see each
 * other.
 */
export function useSessionTabs(channelKey: string | undefined, view: SessionTabView): SessionTabs {
  const [others, setOthers] = useState<ReadonlySet<SessionTabView>>(EMPTY);
  const [settled, setSettled] = useState(false);
  const registryRef = useRef<SessionTabRegistry | null>(null);

  useEffect(() => {
    if (!channelKey) return;
    if (typeof navigator === "undefined" || !navigator.locks) {
      // No Web Locks: every tab acts alone, as before.
      setSettled(true);
      return;
    }
    const tabId = crypto.randomUUID();
    const registry = new SessionTabRegistry(tabId);
    registryRef.current = registry;
    const controller = new AbortController();
    let release = () => {};

    const read = async () => {
      const { held = [] } = await navigator.locks.query();
      if (controller.signal.aborted) return;
      const names = held.flatMap((lock) => (lock.name ? [lock.name] : []));
      registry.update(tabsFromLockNames(channelKey, names), Date.now());
      const next = registry.views();
      setOthers((prev) => (sameViews(prev, next) ? prev : next));
      setSettled(true);
    };

    // A ping makes the others re-read at once instead of on their next poll.
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(`adventure-keeper:session-tabs:${channelKey}`);
    if (channel) channel.onmessage = () => void read();

    navigator.locks
      .request(
        tabLockName(channelKey, { tabId, view }),
        { signal: controller.signal },
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
            channel?.postMessage("changed");
            void read();
          }),
      )
      .catch(() => {});
    const poll = window.setInterval(() => void read(), POLL_MS);

    return () => {
      controller.abort();
      release();
      window.clearInterval(poll);
      channel?.postMessage("changed");
      channel?.close();
      // The registry stays: the page's own unmount cleanup asks it whether
      // leaving this view is leaving the session.
      setOthers(EMPTY);
      setSettled(false);
    };
  }, [channelKey, view]);

  const hasOpenTabs = useCallback(() => registryRef.current?.hasOpenTabs() ?? false, []);
  return { others, settled, hasOpenTabs };
}
