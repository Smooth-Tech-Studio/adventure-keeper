import { describe, expect, it } from "vitest";
import {
  ABILITY_METHODS,
  ABILITY_METHOD_LABELS,
  STANDARD_ARRAY,
  evaluatePointBuy,
  methodAssignsFromPool,
  rollAbilityScore,
} from "./abilities";
import { CLASSES } from "./classes";

describe("rollAbilityScore", () => {
  it("keeps the best three of four d6", () => {
    for (let i = 0; i < 200; i += 1) {
      const { rolls, droppedIndex, total } = rollAbilityScore();
      expect(rolls).toHaveLength(4);
      for (const value of rolls) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
      // The dropped die is a lowest one.
      expect(rolls[droppedIndex]).toBe(Math.min(...rolls));
      const kept = rolls.filter((_, index) => index !== droppedIndex);
      expect(total).toBe(kept.reduce((sum, value) => sum + value, 0));
      expect(total).toBeGreaterThanOrEqual(3);
      expect(total).toBeLessThanOrEqual(18);
    }
  });

  it("drops only one die even when several tie at the lowest", () => {
    // 200 rolls make a tie near-certain; the kept set must always be 3 dice.
    for (let i = 0; i < 200; i += 1) {
      const { rolls, droppedIndex } = rollAbilityScore();
      expect(rolls.filter((_, index) => index !== droppedIndex)).toHaveLength(3);
    }
  });
});

describe("ability methods", () => {
  it("knows which methods hand out a pool to assign", () => {
    expect(methodAssignsFromPool("standardArray")).toBe(true);
    expect(methodAssignsFromPool("roll")).toBe(true);
    expect(methodAssignsFromPool("pointBuy")).toBe(false);
    expect(methodAssignsFromPool("manual")).toBe(false);
  });

  it("labels every method", () => {
    for (const method of ABILITY_METHODS) {
      expect(ABILITY_METHOD_LABELS[method].length).toBeGreaterThan(0);
    }
  });

  it("offers the 2024 standard array", () => {
    expect([...STANDARD_ARRAY]).toEqual([15, 14, 13, 12, 10, 8]);
  });
});

describe("suggested scores", () => {
  it("are a standard-array spread within the point-buy budget, for every class", () => {
    for (const klass of CLASSES) {
      const values = Object.values(klass.suggestedScores);
      expect(
        [...values].sort((a, b) => b - a),
        klass.id,
      ).toEqual(STANDARD_ARRAY);
      expect(evaluatePointBuy(klass.suggestedScores).withinBudget, klass.id).toBe(true);
    }
  });
});
