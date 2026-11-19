import { describe, expect, it } from "vitest";

import {
  MIN_TOKEN_PX,
  cellSizePx,
  scaleFromPoints,
  squaresAcross,
  tokenDiameter,
} from "@/lib/map-scale";

describe("map scale", () => {
  it("reads the map's width from two points and their distance", () => {
    // A 2000 × 1000 image; two points 400 px apart are 6 m apart → 30 m wide.
    const scale = scaleFromPoints({ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.5 }, 6, 2000, 1000)!;
    expect(scale.widthMetres).toBeCloseTo(30);
    expect(squaresAcross(scale)).toBeCloseTo(20);
    // Vertically, the height counts: 0.4 of 1000 px = 400 px too.
    expect(
      scaleFromPoints({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, 6, 2000, 1000)!.widthMetres,
    ).toBeCloseTo(30);
  });

  it("refuses two points at the same place, or no distance", () => {
    expect(scaleFromPoints({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }, 6, 2000, 1000)).toBeNull();
    expect(scaleFromPoints({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 0, 2000, 1000)).toBeNull();
  });

  it("cuts the map's width into squares of 1,5 m", () => {
    expect(cellSizePx({ widthMetres: 30 }, 800)).toBe(40);
    expect(cellSizePx(undefined, 800)).toBeNull();
  });

  it("draws a token over its creature's squares", () => {
    expect(tokenDiameter("medium", 40)).toBeCloseTo(36.8);
    expect(tokenDiameter("large", 40)).toBeCloseTo(73.6);
    expect(tokenDiameter("tiny", 40)).toBeCloseTo(18.4);
    expect(tokenDiameter(undefined, 40)).toBe(tokenDiameter("medium", 40));
  });

  it("never draws a token too small to grab, and keeps sizes apart without a scale", () => {
    expect(tokenDiameter("tiny", 4)).toBe(MIN_TOKEN_PX);
    expect(tokenDiameter("large", null)).toBeGreaterThan(tokenDiameter("medium", null));
  });
});
