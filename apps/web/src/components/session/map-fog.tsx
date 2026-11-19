import { useEffect, useId, useRef } from "react";

import { getCell } from "@/lib/fog-grid";

interface Props {
  /** Packed reveal bitmask (bit set = cell revealed), or null for "all veiled". */
  mask: Uint8Array | null;
  cols: number;
  rows: number;
  /**
   * - `player` / `review` : opaque veil, only revealed cells show through.
   * - `gm` : translucent veil so the GM still sees the whole map.
   */
  role: "gm" | "player" | "review";
  /** Fade newly-revealed cells in (for viewers receiving a commit). */
  animate?: boolean;
}

const VEIL_RGB: [number, number, number] = [10, 10, 15];
const ANIM_MS = 450;
/** Display-only: internal pixels per mask cell, so the smoothing has room. */
const RENDER_SCALE = 3;
/** Display-only: blur radius (CSS px) that rounds the pixel staircase. */
const EDGE_BLUR_PX = 4;

/**
 * "Brouillard" overlay for a hidden location's map. The stored reveal is a
 * coarse `cols × rows` bitmask; the pixel staircase is hidden purely at render
 * time — the mask is rasterised, then a CSS `blur` + an SVG alpha threshold
 * turn the blocky boundary into a smooth vector-looking edge (the 0.5 iso-line
 * of the blurred field). Storage is untouched.
 */
export function MapFog({ mask, cols, rows, role, animate = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const shownRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const filterId = "fog-crisp-" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const veil = role === "gm" ? 0.5 : role === "review" ? 0.82 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cols < 1 || rows < 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const outW = Math.round(cols * RENDER_SCALE);
    const outH = Math.round(rows * RENDER_SCALE);
    if (canvas.width !== outW) canvas.width = outW;
    if (canvas.height !== outH) canvas.height = outH;

    const buffer = bufferRef.current ?? (bufferRef.current = document.createElement("canvas"));
    if (buffer.width !== cols) buffer.width = cols;
    if (buffer.height !== rows) buffer.height = rows;
    const bufferCtx = buffer.getContext("2d");
    if (!bufferCtx) return;

    const n = cols * rows;
    const target = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      target[i] = mask && getCell(mask, i) ? 0 : 1;
    }

    if (!shownRef.current || shownRef.current.length !== n) {
      shownRef.current = target.slice();
    }
    const from = shownRef.current;

    const cellImage = bufferCtx.createImageData(cols, rows);
    const cellData = cellImage.data;

    const paint = (coverage: Float32Array) => {
      for (let i = 0; i < n; i += 1) {
        cellData[i * 4] = VEIL_RGB[0];
        cellData[i * 4 + 1] = VEIL_RGB[1];
        cellData[i * 4 + 2] = VEIL_RGB[2];
        cellData[i * 4 + 3] = Math.round(coverage[i] * 255);
      }
      // putImageData ignores smoothing — blit a 1:1 buffer then upscale it.
      bufferCtx.putImageData(cellImage, 0, 0);
      ctx.clearRect(0, 0, outW, outH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(buffer, 0, 0, outW, outH);
    };

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!animate) {
      shownRef.current = target;
      paint(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS);
      const eased = t * t * (3 - 2 * t);
      const cur = new Float32Array(n);
      for (let i = 0; i < n; i += 1) cur[i] = from[i] + (target[i] - from[i]) * eased;
      paint(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        shownRef.current = target;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mask, cols, rows, animate]);

  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter
          id={filterId}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Steep alpha ramp → the blurred staircase collapses onto its smooth
              0.5 iso-line, keeping ~1px of anti-aliasing. */}
          <feComponentTransfer>
            <feFuncA type="linear" slope="12" intercept="-5.5" />
          </feComponentTransfer>
        </filter>
      </svg>
      <canvas
        ref={canvasRef}
        data-fog
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: veil, filter: `blur(${EDGE_BLUR_PX}px) url(#${filterId})` }}
        aria-hidden
      />
    </>
  );
}
