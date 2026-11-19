import { describe, expect, it } from "vitest";

import { IDLE_DAYS, MAX_SESSION_DAYS, sessionVerdict } from "@/lib/session-policy";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 13);
const stamp = (signedDaysAgo: number, seenDaysAgo: number, remember = true) => ({
  signedInAt: now - signedDaysAgo * DAY,
  lastSeenAt: now - seenDaysAgo * DAY,
  remember,
});

describe("sessionVerdict", () => {
  it("keeps a remembered session within its limits", () => {
    expect(sessionVerdict(stamp(MAX_SESSION_DAYS - 1, 0), now)).toBe("ok");
    expect(sessionVerdict(stamp(10, IDLE_DAYS - 1), now)).toBe("ok");
  });

  it("ends it after the maximum length, even when used every day", () => {
    expect(sessionVerdict(stamp(MAX_SESSION_DAYS + 1, 0), now)).toBe("expired");
  });

  it("ends it after too long without opening the app", () => {
    expect(sessionVerdict(stamp(IDLE_DAYS + 2, IDLE_DAYS + 1), now)).toBe("idle");
  });

  it("leaves an unremembered session to the browser", () => {
    expect(sessionVerdict(stamp(90, 90, false), now)).toBe("ok");
  });
});
