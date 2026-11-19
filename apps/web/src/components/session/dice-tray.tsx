import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  dieMesh,
  emphasisFor,
  faceUpQuat,
  qAxis,
  qMat,
  qMul,
  qNorm,
  qSlerp,
  rotate,
  type DieKind,
  type DieMesh,
  type Emphasis,
  type Mat3,
  type Quat,
} from "@/lib/die-mesh";

/** One die on the tray. */
export interface TrayDie {
  kind: DieKind;
  /** The rolled face value. */
  value: number;
  /** Dimmed — e.g. the discarded die of an advantage / disadvantage roll. */
  faded?: boolean;
}

/** What the tray needs to stage one roll (a d20 test, or a damage pool). */
export interface TrayRoll {
  /** Bumped on every roll so the dice remount and replay. */
  seq: number;
  /** Roll kind label, shown above the dice. */
  label: string;
  dice: TrayDie[];
  /** Final total, modifiers included. */
  total: number;
  /** Human-readable breakdown, e.g. `"d20 12 + 5"`. */
  detail: string;
  /** Optional extra line, e.g. `"14 / 8 → on garde 14 · avantage"`. */
  note?: string;
  /**
   * Communicate the result to the rest of the app (toast, result box). Fired
   * once, only when the animation has fully finished (or the tray is dismissed).
   */
  onReveal?: () => void;
}

const SPIN_MS = 760;
const LAND_MS = 820;
/** Colour bleed-in once the die has landed. */
const REVEAL_MS = 460;
/** Extra frames after the reveal, to let the particles fall. */
const CRIT_TAIL_MS = 900;
const FAIL_TAIL_MS = 620;
const AUTO_CLOSE_MS = 2200;
const MAX_DICE = 30;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const NEUTRAL_FACE: readonly [number, number, number] = [42, 44, 50];
const TARGET_FACE = { crit: [70, 56, 22], fail: [64, 24, 22] } as const;

/**
 * @param emphasis crit / fail / none — decides the *target* colours
 * @param reveal   0 while tumbling (neutral), ramps to 1 after landing
 */
function drawDie(
  ctx: CanvasRenderingContext2D,
  mesh: DieMesh,
  q: Quat,
  cx: number,
  cy: number,
  radius: number,
  bounce: number,
  emphasis: Emphasis,
  reveal: number,
  dpr: number,
) {
  const m: Mat3 = qMat(q);
  const persp = 0.34;
  const projected = mesh.vertices.map((v) => {
    const r = rotate(v, m);
    const s = 1 / (1 + (persp - r[2] * persp));
    return { x: cx + r[0] * radius * s, y: cy - r[1] * radius * s - bounce, z: r[2] };
  });

  const faces = mesh.faces
    .map((f, i) => {
      const n = rotate(mesh.faceNormals[i], m);
      const zc = f.reduce((s, k) => s + projected[k].z, 0) / f.length;
      return { f, i, n, zc };
    })
    .sort((a, b) => a.zc - b.zc);

  const crit = emphasis === "crit";
  const fail = emphasis === "fail";
  const tgt = emphasis ? TARGET_FACE[emphasis] : NEUTRAL_FACE;
  const baseR = lerp(NEUTRAL_FACE[0], tgt[0], reveal);
  const baseG = lerp(NEUTRAL_FACE[1], tgt[1], reveal);
  const baseB = lerp(NEUTRAL_FACE[2], tgt[2], reveal);

  for (const o of faces) {
    if (o.n[2] < -0.05) continue; // back faces
    const pts = o.f.map((k) => projected[k]);
    const lit = Math.max(0, o.n[0] * 0.42 + o.n[1] * 0.55 + o.n[2] * 0.72);
    const k = 0.3 + lit * 0.82;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${(baseR * k + 12) | 0},${(baseG * k + 12) | 0},${(baseB * k + 15) | 0})`;
    ctx.fill();
    const sr = lerp(208, fail ? 224 : crit ? 238 : 208, reveal);
    const sg = lerp(214, fail ? 120 : crit ? 202 : 214, reveal);
    const sb = lerp(226, fail ? 112 : crit ? 128 : 226, reveal);
    ctx.strokeStyle = `rgba(${sr | 0},${sg | 0},${sb | 0},${0.16 + Math.max(0, o.n[2]) * 0.5})`;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    const facing = o.n[2];
    if (facing > 0.32) {
      const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const sz = radius * mesh.glyphScale * (0.62 + facing * 0.5);
      const alpha = Math.min(1, (facing - 0.32) / 0.4);
      ctx.save();
      ctx.font = `600 ${sz}px ui-serif, Georgia, "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (facing > 0.82) {
        if (emphasis && reveal > 0.01) {
          const g = fail ? [224, 90, 78] : [240, 202, 96];
          ctx.shadowColor = `rgba(${g[0]},${g[1]},${g[2]},${0.3 + 0.55 * reveal})`;
          ctx.shadowBlur = (13 + reveal * 22) * dpr;
        } else {
          ctx.shadowColor = "rgba(255,255,255,0.32)";
          ctx.shadowBlur = 14 * dpr;
        }
      }
      const gr = lerp(238, fail ? 255 : crit ? 250 : 238, reveal);
      const gg = lerp(236, fail ? 206 : crit ? 232 : 236, reveal);
      const gb = lerp(228, fail ? 198 : crit ? 176 : 228, reveal);
      ctx.fillStyle = `rgba(${gr | 0},${gg | 0},${gb | 0},${alpha})`;
      ctx.fillText(String(mesh.faceValue[o.i]), mx, my + sz * 0.04);
      ctx.restore();
    }
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
}

function critSparks(cx: number, cy: number, radius: number): Particle[] {
  return Array.from({ length: 24 }, () => {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const spd = radius * (0.035 + Math.random() * 0.075);
    return {
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 1,
      decay: 0.012 + Math.random() * 0.02,
    };
  });
}

function failShards(cx: number, cy: number, radius: number): Particle[] {
  return Array.from({ length: 7 }, () => ({
    x: cx + (Math.random() - 0.5) * radius * 0.5,
    y: cy + (Math.random() - 0.5) * radius * 0.3,
    vx: (Math.random() - 0.5) * radius * 0.03,
    vy: radius * (0.004 + Math.random() * 0.018),
    life: 1,
    decay: 0.014 + Math.random() * 0.016,
  }));
}

export interface DieProps {
  kind: DieKind;
  value: number;
  /** In-plane spin seed so identical values don't land identically. */
  spinSeed: number;
  size: number;
  emphasis: Emphasis;
  faded: boolean;
  /** Fired once the die (and its reveal flourish) has fully settled. */
  onRest: () => void;
  /** Bump to replay the animation. */
  replayKey: number;
}

/**
 * One tumbling die. Spins in neutral grey, decelerates onto the target face,
 * then — for a natural max / 1 — plays a short reveal: the colour bleeds in with
 * gold sparks (crit) or a red shudder + shockwave + falling shards (fail).
 * The loop stops on the final resting frame so the die stays perfectly static.
 * Exported so other spots (e.g. the free-roll dice block) can stage the same
 * animation inline instead of through the full-screen {@link DiceTray}.
 */
export function Die({ kind, value, spinSeed, size, emphasis, faded, onRest, replayKey }: DieProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onRestRef = useRef(onRest);
  useEffect(() => {
    onRestRef.current = onRest;
  });
  const [settledLook, setSettledLook] = useState(false);

  useEffect(() => {
    setSettledLook(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const mesh = dieMesh(kind);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = size * dpr;
    const h = size * dpr;
    canvas.width = w;
    canvas.height = h;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.33 * mesh.renderScale;

    const revealMs = emphasis ? REVEAL_MS : 0;
    const tailMs = emphasis === "crit" ? CRIT_TAIL_MS : emphasis === "fail" ? FAIL_TAIL_MS : 0;

    let raf = 0;
    let phase: "spin" | "land" | "reveal" | "done" = "spin";
    let t0 = performance.now();
    let revealAt = 0;
    let particles: Particle[] = [];
    let q = qNorm([0.4, 0.7, 0.3, 0.5]);
    let qFrom = q;
    const qTo = faceUpQuat(mesh, value, spinSeed);
    const vel = [0.16 + Math.random() * 0.09, 0.17 + Math.random() * 0.12];
    let rested = false;

    const settle = () => {
      if (rested) return;
      rested = true;
      setSettledLook(true);
      onRestRef.current();
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      let bounce = 0;
      let reveal = 0;
      let shakeX = 0;
      let shakeY = 0;
      let pop = 1;

      if (phase === "spin") {
        const el = now - t0;
        q = qNorm(qMul(qAxis([1, 0.6, 0.35], vel[0]), q));
        q = qNorm(qMul(qAxis([0.3, 1, 0.7], vel[1]), q));
        bounce = Math.abs(Math.sin(el / 135)) * radius * 0.26 * Math.max(0, 1 - el / SPIN_MS);
        if (el > SPIN_MS) {
          phase = "land";
          t0 = now;
          qFrom = q;
        }
      } else if (phase === "land") {
        const p = Math.min(1, (now - t0) / LAND_MS);
        q = qSlerp(qFrom, qTo, 1 - Math.pow(1 - p, 3.2));
        bounce = Math.abs(Math.sin(p * Math.PI * 2.4)) * radius * 0.1 * (1 - p);
        if (p >= 1) {
          q = qTo;
          phase = "reveal";
          revealAt = now;
          if (emphasis === "crit") particles = critSparks(cx, cy, radius);
          else if (emphasis === "fail") particles = failShards(cx, cy, radius);
        }
      } else {
        q = qTo;
      }

      let e = 0;
      if (phase === "reveal" || phase === "done") {
        e = now - revealAt;
        const rp = revealMs > 0 ? Math.min(1, e / revealMs) : 1;
        reveal = easeOutCubic(rp);
        pop = 1 + 0.05 * Math.sin(rp * Math.PI);
        if (emphasis === "fail") {
          const decay = Math.max(0, 1 - e / 380);
          shakeX = Math.sin(e * 0.05) * radius * 0.09 * decay;
          shakeY = Math.cos(e * 0.055) * radius * 0.03 * decay;
        }
        if (phase === "reveal" && rp >= 1) {
          phase = "done";
          settle();
        }
      }

      drawDie(ctx, mesh, q, cx + shakeX, cy + shakeY, radius * pop, bounce, emphasis, reveal, dpr);

      // --- reveal flourish -------------------------------------------------
      if (phase === "reveal" || phase === "done") {
        if (emphasis === "crit") {
          const rp = Math.min(1, e / 520);
          if (rp < 1) {
            ctx.strokeStyle = `rgba(250,210,130,${(1 - rp) * 0.55})`;
            ctx.lineWidth = (2 + (1 - rp) * 3) * dpr;
            ctx.beginPath();
            ctx.arc(cx, cy, radius * (0.5 + rp * 2.1), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (emphasis === "fail") {
          const rp = Math.min(1, e / 480);
          if (rp < 1) {
            ctx.strokeStyle = `rgba(150,42,38,${(1 - rp) * 0.5})`;
            ctx.lineWidth = (3 + (1 - rp) * 3) * dpr;
            ctx.beginPath();
            ctx.arc(cx, cy, radius * (0.3 + rp * 2.3), 0, Math.PI * 2);
            ctx.stroke();
          }
          const flash = Math.max(0, 1 - e / 130);
          if (flash > 0) {
            ctx.fillStyle = `rgba(120,22,20,${flash * 0.4})`;
            ctx.fillRect(0, 0, w, h);
          }
        }

        for (const s of particles) {
          if (s.life <= 0) continue;
          s.vy += radius * (emphasis === "fail" ? 0.004 : 0.0022);
          s.vx *= 0.985;
          s.x += s.vx;
          s.y += s.vy;
          s.life -= s.decay;
          if (emphasis === "fail") {
            const d = 3.2 * dpr;
            ctx.fillStyle = `rgba(${(150 + 20 * s.life) | 0},${(42 + 15 * s.life) | 0},${(38 + 10 * s.life) | 0},${Math.max(0, s.life)})`;
            ctx.fillRect(s.x - d / 2, s.y - d / 2, d, d);
          } else {
            ctx.strokeStyle = `rgba(255,${(180 + 60 * s.life) | 0},${(90 + 40 * s.life) | 0},${Math.max(0, s.life)})`;
            ctx.lineWidth = 2.2 * dpr;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2);
            ctx.stroke();
          }
        }
      }

      const particlesDone = particles.every((s) => s.life <= 0);
      if (phase === "done" && (e >= revealMs + tailMs || particlesDone)) {
        ctx.clearRect(0, 0, w, h);
        drawDie(ctx, mesh, qTo, cx, cy, radius, 0, emphasis, emphasis ? 1 : 0, dpr);
        return; // freeze — no more frames
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, value, spinSeed, size, emphasis, replayKey]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={cn(
        "transition-opacity duration-500",
        faded && settledLook ? "opacity-30" : "opacity-100",
      )}
      aria-hidden
    />
  );
}

function dieSizeFor(count: number): number {
  if (count >= 12) return 82;
  if (count >= 7) return 108;
  if (count >= 4) return 132;
  if (count > 1) return 152;
  return 200;
}

/**
 * Full-screen overlay that stages a roll: the die(s) tumble in neutral grey,
 * land, then reveal their colour (gold / red) with a flourish. The result is
 * communicated (toast, result box) and shown here only once every die has
 * fully settled. Dismissed on tap / Escape, auto-closes shortly after.
 */
export function DiceTray({ roll, onClose }: { roll: TrayRoll | null; onClose: () => void }) {
  const { t } = useTranslation("session", { keyPrefix: "tray" });
  const [settled, setSettled] = useState(0);
  const bumpSettled = useCallback(() => setSettled((n) => n + 1), []);

  const revealedRef = useRef(false);
  const prevRef = useRef<TrayRoll | null>(null);
  useEffect(() => {
    // A new roll replacing an un-communicated one: communicate the old one now
    // so a fast re-roll never swallows its result.
    if (prevRef.current && prevRef.current !== roll && !revealedRef.current) {
      prevRef.current.onReveal?.();
    }
    prevRef.current = roll;
    revealedRef.current = false;
    setSettled(0);
  }, [roll?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const fireReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    roll?.onReveal?.();
  }, [roll]);

  const shown = useMemo(() => (roll ? roll.dice.slice(0, MAX_DICE) : []), [roll]);
  const done = roll != null && settled >= shown.length;

  useEffect(() => {
    if (!done) return;
    fireReveal();
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [done, onClose, fireReveal]);

  const close = useCallback(() => {
    fireReveal();
    onClose();
  }, [fireReveal, onClose]);

  useEffect(() => {
    if (!roll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roll, close]);

  if (!roll) return null;

  const size = dieSizeFor(shown.length);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Jet — ${roll.label}`}
      onClick={close}
    >
      <p className="text-[11px] font-medium tracking-[0.3em] text-white/60 uppercase">
        {roll.label}
      </p>

      <div className="flex max-w-[min(90vw,42rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 shadow-2xl">
        {shown.map((die, i) => (
          <Die
            key={i}
            replayKey={roll.seq}
            kind={die.kind}
            value={die.value}
            spinSeed={roll.seq * 1.7 + i * 2.3}
            size={size}
            emphasis={emphasisFor(die)}
            faded={die.faded ?? false}
            onRest={bumpSettled}
          />
        ))}
      </div>

      <div
        className={cn(
          "max-w-md text-center transition-opacity duration-300",
          done ? "opacity-100" : "opacity-0",
        )}
      >
        {roll.note && <p className="text-sm text-white/70">{roll.note}</p>}
        <p className="text-xs break-words text-white/50">{roll.detail}</p>
        <div className="text-5xl font-bold text-white tabular-nums">{roll.total}</div>
        <p className="mt-1 text-[11px] text-white/40">{t("tapToClose")}</p>
      </div>
    </div>,
    document.body,
  );
}
