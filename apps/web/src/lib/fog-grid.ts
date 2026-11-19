/**
 * Fog of war as a raster mask. The hidden location's map is diced into a
 * `cols × rows` grid of cells that are **square in image space** (so the
 * eraser paints a true circle whatever the image's aspect ratio). Each cell is
 * one bit — `1` = revealed — packed 8 per byte and stored base64.
 */

/** Cells along the image's longer edge. ~5 KB packed for a 16:9 map. */
export const FOG_LONG_EDGE = 240;

export interface FogGrid {
  cols: number;
  rows: number;
}

/** Grid dimensions for an image aspect ratio (width / height). */
export function fogGridFor(aspect: number): FogGrid {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return { cols: FOG_LONG_EDGE, rows: FOG_LONG_EDGE };
  }
  if (aspect >= 1) {
    return { cols: FOG_LONG_EDGE, rows: Math.max(1, Math.round(FOG_LONG_EDGE / aspect)) };
  }
  return { cols: Math.max(1, Math.round(FOG_LONG_EDGE * aspect)), rows: FOG_LONG_EDGE };
}

const bytesFor = (cols: number, rows: number) => Math.ceil((cols * rows) / 8);

export function emptyMask(cols: number, rows: number): Uint8Array {
  return new Uint8Array(bytesFor(cols, rows));
}

export function filledMask(cols: number, rows: number): Uint8Array {
  const mask = emptyMask(cols, rows);
  mask.fill(0xff);
  return mask;
}

export function getCell(mask: Uint8Array, index: number): boolean {
  return (mask[index >> 3] & (1 << (index & 7))) !== 0;
}

function setCell(mask: Uint8Array, index: number, on: boolean): void {
  const byte = index >> 3;
  const bit = 1 << (index & 7);
  if (on) mask[byte] |= bit;
  else mask[byte] &= ~bit;
}

/**
 * Paint a filled disc into the mask. `cx` / `cy` / `rFrac` are fractions of the
 * image (radius is a fraction of the *width*). `reveal` sets cells, otherwise
 * clears them. Returns whether any cell changed.
 */
export function paintDisc(
  mask: Uint8Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  rFrac: number,
  reveal: boolean,
): boolean {
  const gx = cx * cols;
  const gy = cy * rows;
  const gr = Math.max(0.5, rFrac * cols);
  const gr2 = gr * gr;
  const x0 = Math.max(0, Math.floor(gx - gr));
  const x1 = Math.min(cols - 1, Math.ceil(gx + gr));
  const y0 = Math.max(0, Math.floor(gy - gr));
  const y1 = Math.min(rows - 1, Math.ceil(gy + gr));
  let changed = false;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - gx;
      const dy = y + 0.5 - gy;
      if (dx * dx + dy * dy > gr2) continue;
      const index = y * cols + x;
      if (getCell(mask, index) !== reveal) {
        setCell(mask, index, reveal);
        changed = true;
      }
    }
  }
  return changed;
}

export function packMask(mask: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < mask.length; i += 1) binary += String.fromCharCode(mask[i]);
  return btoa(binary);
}

export function unpackMask(base64: string, cols: number, rows: number): Uint8Array {
  const out = emptyMask(cols, rows);
  try {
    const binary = atob(base64);
    for (let i = 0; i < Math.min(out.length, binary.length); i += 1) {
      out[i] = binary.charCodeAt(i);
    }
  } catch {
    /* malformed — treat as fully veiled */
  }
  return out;
}

/** Nearest-neighbour resample when the grid dimensions change between clients. */
export function resampleMask(
  src: Uint8Array,
  srcCols: number,
  srcRows: number,
  dstCols: number,
  dstRows: number,
): Uint8Array {
  if (srcCols === dstCols && srcRows === dstRows) return src.slice();
  const dst = emptyMask(dstCols, dstRows);
  for (let y = 0; y < dstRows; y += 1) {
    const sy = Math.min(srcRows - 1, Math.floor((y / dstRows) * srcRows));
    for (let x = 0; x < dstCols; x += 1) {
      const sx = Math.min(srcCols - 1, Math.floor((x / dstCols) * srcCols));
      if (getCell(src, sy * srcCols + sx)) setCell(dst, y * dstCols + x, true);
    }
  }
  return dst;
}
