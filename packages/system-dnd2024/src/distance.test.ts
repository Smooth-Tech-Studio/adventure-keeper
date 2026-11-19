import { describe, expect, it } from "vitest";
import { feetToMetres, formatDistance } from "./distance";

describe("formatDistance", () => {
  it("writes the usual speeds as the rulebook does", () => {
    expect(formatDistance(30)).toBe("9 m");
    expect(formatDistance(35)).toBe("10,50 m");
    expect(formatDistance(60)).toBe("18 m");
    expect(formatDistance(120)).toBe("36 m");
  });

  it("writes a single square and a half-square", () => {
    expect(formatDistance(5)).toBe("1,50 m");
    expect(formatDistance(10)).toBe("3 m");
  });

  it("leaves zero alone", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(feetToMetres(0)).toBe(0);
  });
});
