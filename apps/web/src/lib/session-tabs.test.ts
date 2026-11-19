import { describe, expect, it } from "vitest";

import {
  SessionTabRegistry,
  TAB_GRACE_MS,
  tabLockName,
  tabsFromLockNames,
  type SessionTab,
} from "./session-tabs";

const main: SessionTab = { tabId: "a", view: "main" };
const map: SessionTab = { tabId: "b", view: "carte" };

describe("tab lock names", () => {
  it("round-trip, and only for the right session", () => {
    const names = [
      tabLockName("s1:bob", main),
      tabLockName("s1:bob", map),
      tabLockName("s2:bob", map),
      "some-other-lock",
    ];
    expect(tabsFromLockNames("s1:bob", names)).toEqual([main, map]);
  });

  it("skips a lock with an unknown view", () => {
    expect(tabsFromLockNames("s1", ["adventure-keeper:session-tab:s1|tele|x"])).toEqual([]);
  });
});

describe("SessionTabRegistry", () => {
  it("lists the other tabs, not itself", () => {
    const registry = new SessionTabRegistry("a");
    registry.update([main, map], 0);
    expect(registry.views()).toEqual(new Set(["carte"]));
    expect(registry.hasOpenTabs()).toBe(true);
  });

  it("a closed tab lingers for the grace period, then goes", () => {
    const registry = new SessionTabRegistry("a");
    registry.update([main, map], 0);
    registry.update([main], 1_000);
    expect(registry.views()).toEqual(new Set(["carte"]));
    expect(registry.hasOpenTabs()).toBe(false);

    registry.update([main], 1_000 + TAB_GRACE_MS);
    expect(registry.views()).toEqual(new Set());
  });

  it("a refreshed tab never drops out", () => {
    const registry = new SessionTabRegistry("a");
    registry.update([main, map], 0);
    registry.update([main], 500);
    // The reloaded page is a new tab with a new id.
    registry.update([main, { tabId: "c", view: "carte" }], 1_500);
    registry.update([main, { tabId: "c", view: "carte" }], 500 + TAB_GRACE_MS);
    expect(registry.views()).toEqual(new Set(["carte"]));
  });

  it("a tab that comes back is open again", () => {
    const registry = new SessionTabRegistry("a");
    registry.update([main, map], 0);
    registry.update([main], 100);
    registry.update([main, map], 200);
    expect(registry.hasOpenTabs()).toBe(true);
    registry.update([main, map], 200 + TAB_GRACE_MS);
    expect(registry.views()).toEqual(new Set(["carte"]));
  });
});
