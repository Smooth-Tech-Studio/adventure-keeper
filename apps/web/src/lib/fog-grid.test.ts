import { describe, expect, it } from "vitest";

import {
  FOG_LONG_EDGE,
  emptyMask,
  filledMask,
  fogGridFor,
  getCell,
  packMask,
  paintDisc,
  resampleMask,
  unpackMask,
} from "./fog-grid";

describe("fogGridFor", () => {
  it("puts FOG_LONG_EDGE cells on the longer edge", () => {
    expect(fogGridFor(16 / 9)).toEqual({ cols: FOG_LONG_EDGE, rows: 135 });
    expect(fogGridFor(9 / 16)).toEqual({ cols: 135, rows: FOG_LONG_EDGE });
    expect(fogGridFor(1)).toEqual({ cols: FOG_LONG_EDGE, rows: FOG_LONG_EDGE });
  });

  it("falls back to a square grid for a bad ratio", () => {
    expect(fogGridFor(0)).toEqual({ cols: FOG_LONG_EDGE, rows: FOG_LONG_EDGE });
    expect(fogGridFor(Number.NaN)).toEqual({ cols: FOG_LONG_EDGE, rows: FOG_LONG_EDGE });
  });
});

describe("pack / unpack", () => {
  it("round-trips an arbitrary mask", () => {
    const cols = 40;
    const rows = 25;
    const mask = emptyMask(cols, rows);
    paintDisc(mask, cols, rows, 0.5, 0.5, 0.2, true);
    const back = unpackMask(packMask(mask), cols, rows);
    expect(Array.from(back)).toEqual(Array.from(mask));
  });

  it("treats a malformed string as fully veiled", () => {
    const back = unpackMask("not base64!!!", 8, 8);
    expect(back.every((byte) => byte === 0)).toBe(true);
  });
});

describe("paintDisc", () => {
  it("reveals the cells inside the disc and reports the change", () => {
    const cols = 20;
    const rows = 20;
    const mask = emptyMask(cols, rows);
    const changed = paintDisc(mask, cols, rows, 0.5, 0.5, 0.1, true);
    expect(changed).toBe(true);
    expect(getCell(mask, 10 * cols + 10)).toBe(true);
    // A corner well outside the disc stays veiled.
    expect(getCell(mask, 0)).toBe(false);
  });

  it("is a no-op when nothing changes", () => {
    const cols = 20;
    const rows = 20;
    const mask = filledMask(cols, rows);
    expect(paintDisc(mask, cols, rows, 0.5, 0.5, 0.1, true)).toBe(false);
  });

  it("clears cells when reveal is false", () => {
    const cols = 20;
    const rows = 20;
    const mask = filledMask(cols, rows);
    paintDisc(mask, cols, rows, 0.5, 0.5, 0.1, false);
    expect(getCell(mask, 10 * cols + 10)).toBe(false);
  });
});

describe("resampleMask", () => {
  it("keeps a revealed region across a resize", () => {
    const src = emptyMask(20, 20);
    paintDisc(src, 20, 20, 0.5, 0.5, 0.25, true);
    const dst = resampleMask(src, 20, 20, 40, 40);
    expect(getCell(dst, 20 * 40 + 20)).toBe(true);
    expect(getCell(dst, 0)).toBe(false);
  });

  it("returns a copy when the dimensions are unchanged", () => {
    const src = filledMask(8, 8);
    const dst = resampleMask(src, 8, 8, 8, 8);
    expect(dst).not.toBe(src);
    expect(Array.from(dst)).toEqual(Array.from(src));
  });
});
