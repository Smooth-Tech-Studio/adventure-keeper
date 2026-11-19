import { describe, expect, it } from "vitest";

import { initials, isNightTime, tokenLabel } from "./format";

describe("isNightTime", () => {
  it("is night from 22:00 through 06:29", () => {
    expect(isNightTime("22:00")).toBe(true);
    expect(isNightTime("23:59")).toBe(true);
    expect(isNightTime("00:00")).toBe(true);
    expect(isNightTime("06:29")).toBe(true);
  });

  it("is day from 06:30 through 21:59", () => {
    expect(isNightTime("06:30")).toBe(false);
    expect(isNightTime("12:00")).toBe(false);
    expect(isNightTime("21:59")).toBe(false);
  });

  it("defaults to day for missing or malformed labels", () => {
    expect(isNightTime(undefined)).toBe(false);
    expect(isNightTime("")).toBe(false);
    expect(isNightTime("minuit")).toBe(false);
    expect(isNightTime("7h")).toBe(false);
  });
});

describe("tokenLabel", () => {
  it("keeps the instance number", () => {
    expect(tokenLabel("Combattant gobelin 1")).toBe("G1");
    expect(tokenLabel("Combattant gobelin 12")).toBe("G12");
    expect(tokenLabel("Squelette 2")).toBe("S2");
  });

  it("falls back to initials without a number", () => {
    expect(tokenLabel("Thorin Poing-de-Fer")).toBe(initials("Thorin Poing-de-Fer"));
    expect(tokenLabel("Molosse")).toBe("MO");
  });
});
