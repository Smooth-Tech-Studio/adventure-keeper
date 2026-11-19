import { describe, expect, it } from "vitest";
import {
  EPIC_BOON_LEVEL,
  XP_THRESHOLDS,
  asiCount,
  asiLevels,
  asiLevelsUpTo,
  levelForXp,
  xpForLevel,
  xpToNextLevel,
} from "./progression";
import { weaponMasteryCount } from "./classes";

describe("levelForXp", () => {
  it("clamps to level 1 at or below 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(299)).toBe(1);
  });

  it("bumps a level exactly on the threshold", () => {
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(900)).toBe(3);
    expect(levelForXp(2_700)).toBe(4);
  });

  it("caps at level 20", () => {
    expect(levelForXp(355_000)).toBe(20);
    expect(levelForXp(9_999_999)).toBe(20);
  });

  it("is monotonic across the whole table", () => {
    for (let i = 1; i < XP_THRESHOLDS.length; i += 1) {
      expect(levelForXp(XP_THRESHOLDS[i])).toBe(i + 1);
      expect(levelForXp(XP_THRESHOLDS[i] - 1)).toBe(i);
    }
  });

  it("tolerates NaN / fractional input", () => {
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelForXp(6_500.9)).toBe(5);
  });
});

describe("xpForLevel", () => {
  it("returns the threshold, clamped to 1..20", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(5)).toBe(6_500);
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(99)).toBe(355_000);
  });
});

describe("xpToNextLevel", () => {
  it("returns the gap to the next threshold", () => {
    expect(xpToNextLevel(0)).toBe(300);
    expect(xpToNextLevel(100)).toBe(200);
    expect(xpToNextLevel(300)).toBe(600);
  });

  it("is null at level 20", () => {
    expect(xpToNextLevel(355_000)).toBeNull();
    expect(xpToNextLevel(400_000)).toBeNull();
  });
});

describe("ability-score improvements", () => {
  it("gives most classes 4 / 8 / 12 / 16", () => {
    expect(asiLevels("wizard")).toEqual([4, 8, 12, 16]);
    expect(asiLevels("druid")).toEqual([4, 8, 12, 16]);
    expect(asiLevels("unknown-class")).toEqual([4, 8, 12, 16]);
  });

  it("gives the fighter two extra and the rogue one", () => {
    expect(asiLevels("fighter")).toEqual([4, 6, 8, 12, 14, 16]);
    expect(asiLevels("rogue")).toEqual([4, 8, 10, 12, 16]);
  });

  it("counts only those already reached", () => {
    expect(asiLevelsUpTo("fighter", 1)).toEqual([]);
    expect(asiLevelsUpTo("fighter", 6)).toEqual([4, 6]);
    expect(asiCount("fighter", 20)).toBe(6);
    expect(asiCount("wizard", 20)).toBe(4);
    expect(asiCount("rogue", 10)).toBe(3);
  });

  it("puts the epic boon at 19", () => {
    expect(EPIC_BOON_LEVEL).toBe(19);
    expect(asiLevels("fighter")).not.toContain(EPIC_BOON_LEVEL);
  });
});

describe("weapon mastery", () => {
  it("follows the SRD class tables", () => {
    const at = (classId: string) =>
      [1, 4, 10, 16, 20].map((level) => weaponMasteryCount(classId, level));
    expect(at("barbarian")).toEqual([2, 3, 4, 4, 4]);
    expect(at("fighter")).toEqual([3, 4, 5, 6, 6]);
    for (const classId of ["paladin", "ranger", "rogue"])
      expect(at(classId)).toEqual([2, 2, 2, 2, 2]);
    expect(at("wizard")).toEqual([0, 0, 0, 0, 0]);
  });
});
