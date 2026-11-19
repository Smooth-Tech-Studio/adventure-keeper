import { describe, expect, it } from "vitest";

import { isDue, minutesBetween, minutesOf, stepGameTime } from "@/lib/game-time";

describe("stepGameTime", () => {
  it("moves the day with the clock, past midnight and back", () => {
    expect(stepGameTime({ day: 2, time: "23:45" }, 30)).toEqual({ day: 3, time: "00:15" });
    expect(stepGameTime({ day: 3, time: "00:15" }, -30)).toEqual({ day: 2, time: "23:45" });
    expect(stepGameTime({ day: 1, time: "00:10" }, -30)).toEqual({ day: 1, time: "23:40" });
  });

  it("starts an unset clock at noon on day 1", () => {
    expect(stepGameTime({}, 30)).toEqual({ day: 1, time: "12:30" });
  });
});

describe("isDue", () => {
  it("waits for the day, then the time", () => {
    const moment = { day: 3, time: "22:00" };
    expect(isDue(moment, { day: 2, time: "23:00" })).toBe(false);
    expect(isDue(moment, { day: 3, time: "21:30" })).toBe(false);
    expect(isDue(moment, { day: 3, time: "22:00" })).toBe(true);
    expect(isDue(moment, { day: 4, time: "08:00" })).toBe(true);
  });

  it("reads a time alone as today's, a day alone as the whole day", () => {
    expect(isDue({ time: "22:00" }, { day: 5, time: "22:30" })).toBe(true);
    expect(isDue({ time: "22:00" }, { day: 5, time: "21:00" })).toBe(false);
    expect(isDue({ day: 2 }, { day: 2, time: "06:00" })).toBe(true);
    expect(isDue({}, { day: 9, time: "23:59" })).toBe(false);
  });
});

describe("helpers", () => {
  it("reads HH:MM (and 14h30), and counts minutes", () => {
    expect(minutesOf("14h30")).toBe(870);
    expect(minutesOf("midi")).toBeNull();
    expect(minutesBetween(0, 1000)).toBeNull();
    expect(minutesBetween(1_000, 1_000 + 195 * 60000)).toBe(195);
  });
});
