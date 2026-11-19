import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWizardSnapshot, describeAge } from "./use-wizard-autosave";

describe("describeAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads in minutes, hours then days", () => {
    const now = new Date("2026-10-02T12:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(describeAge(now)).toBe("à l'instant");
    expect(describeAge(now - 3 * 60_000)).toBe("il y a 3 min");
    expect(describeAge(now - 90 * 60_000)).toBe("il y a 2 h");
    expect(describeAge(now - 50 * 3_600_000)).toBe("il y a 2 j");
  });
});

describe("clearWizardSnapshot", () => {
  it("never throws when the store is unreachable", () => {
    // These tests run without a DOM, so `window` is undefined — exactly the
    // shape of a private window or a blocked store, which must not break the
    // wizard.
    expect(() => clearWizardSnapshot()).not.toThrow();
  });
});
