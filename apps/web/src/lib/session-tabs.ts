import { isSessionPane, type SessionPane } from "@/lib/session-panes";

/**
 * What a tab of a live session shows: the whole view (`main`) or a single
 * block opened in its own tab.
 */
export type SessionTabView = "main" | SessionPane;

/** One open tab, as read from the lock it holds. */
export interface SessionTab {
  tabId: string;
  view: SessionTabView;
}

/**
 * A tab that disappeared still counts for this long (ms): a refresh is a close
 * then an open, and the other tabs mustn't reshuffle their layout in between.
 */
export const TAB_GRACE_MS = 2_500;

const LOCK_PREFIX = "adventure-keeper:session-tab:";

/**
 * Each open tab holds a Web Lock named after it for as long as it lives; the
 * browser releases it when the tab goes, crash included, with no timer to keep
 * alive (a hidden tab's timers get throttled to once a minute).
 */
export function tabLockName(channelKey: string, tab: SessionTab): string {
  return `${LOCK_PREFIX}${channelKey}|${tab.view}|${tab.tabId}`;
}

/** The tabs of `channelKey` among the held lock names. */
export function tabsFromLockNames(channelKey: string, names: string[]): SessionTab[] {
  const prefix = `${LOCK_PREFIX}${channelKey}|`;
  return names.flatMap((name) => {
    if (!name.startsWith(prefix)) return [];
    const [view, tabId] = name.slice(prefix.length).split("|");
    if (!tabId || (view !== "main" && !isSessionPane(view))) return [];
    return [{ tabId, view: view as SessionTabView }];
  });
}

/**
 * The other tabs of this session, from successive readings of the held locks.
 * Pure bookkeeping: the hook feeds it the readings and the clock.
 */
export class SessionTabRegistry {
  private readonly seen = new Map<string, { view: SessionTabView; goneAt: number | null }>();

  constructor(private readonly selfId: string) {}

  /** A fresh reading of the open tabs. */
  update(open: SessionTab[], now: number) {
    const openIds = new Set<string>();
    for (const { tabId, view } of open) {
      if (tabId === this.selfId) continue;
      openIds.add(tabId);
      this.seen.set(tabId, { view, goneAt: null });
    }
    for (const [tabId, tab] of this.seen) {
      if (openIds.has(tabId)) continue;
      tab.goneAt ??= now;
      if (now - tab.goneAt >= TAB_GRACE_MS) this.seen.delete(tabId);
    }
  }

  /** Views of the other tabs, closed ones included during the grace period. */
  views(): Set<SessionTabView> {
    return new Set([...this.seen.values()].map((tab) => tab.view));
  }

  /**
   * Whether another tab is open right now — not one that just went. Decides
   * whether closing this tab leaves the session.
   */
  hasOpenTabs(): boolean {
    return [...this.seen.values()].some((tab) => tab.goneAt === null);
  }
}
