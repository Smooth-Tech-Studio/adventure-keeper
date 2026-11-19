import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MaximizeIcon, Trash2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import type { MapScale, SessionCombatant, SessionMapReveal } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapFog } from "@/components/session/map-fog";
import {
  emptyMask,
  fogGridFor,
  packMask,
  paintDisc,
  resampleMask,
  unpackMask,
  type FogGrid,
} from "@/lib/fog-grid";
import { useBufferedWrites } from "@/hooks/use-buffered-writes";
import { cn } from "@/lib/utils";
import { tokenLabel } from "@/lib/format";
import { cellSizePx, tokenDiameter } from "@/lib/map-scale";
import type { WithId } from "@/lib/collections";
import { combatantColor } from "@/lib/combatant-color";

interface Props {
  imageUrl?: string;
  combatants: WithId<SessionCombatant>[];
  canEdit: boolean;
  onMove: (id: string, x: number, y: number) => void;
  /**
   * GM only: clicking a token opens a small menu offering to delete it (the
   * combatant goes, from the initiative too). Without it, tokens have no menu.
   */
  onDestroyToken?: (id: string) => void;
  /** Forwarded to the map surface so it can be grabbed from the console. */
  id?: string;
  /** Fill the parent (letterboxed) instead of taking the full width. */
  fill?: boolean;
  /** The current location is hidden — draw the fog of war. */
  hidden?: boolean;
  /** Persisted reveal state for the current location. */
  reveal?: WithId<SessionMapReveal> | null;
  /** How the fog is drawn: `gm` (translucent) vs `player` (opaque). */
  fogRole?: "gm" | "player";
  /** GM is in "eraser" mode: pointer reveals cells, tokens stay put. */
  eraserActive?: boolean;
  /** GM is in "fog brush" mode: pointer paints the veil back on. */
  fogBrushActive?: boolean;
  /** Brush radius as a fraction of the image width. */
  brushRadius?: number;
  /** Commit the whole reveal mask (on tool release / autosave / unmount). */
  onCommitFog?: (mask: string, cols: number, rows: number) => void;
  /** Report the fog grid dimensions once the image aspect ratio is known. */
  onGridReady?: (cols: number, rows: number) => void;
  /** The map's scale: tokens take their creature's squares. */
  mapScale?: MapScale;
  /** Draw the squares (this viewer's own choice). Needs a scale. */
  showGrid?: boolean;
  /**
   * The session plays through a realtime server: a dragged token and the fog
   * being painted reach everyone continuously.
   */
  realtime?: boolean;
}

interface ContentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** A press that travels less than this (px) is a click, not a drag. */
const CLICK_SLOP = 4;
const AUTOSAVE_MS = 6_000;
/**
 * Through a realtime server: the fog while it is painted. Each send is the
 * whole mask (a few KB), so it is spread out a little rather than sent at
 * each pointer move — 20 a second, smooth to the eye.
 */
const FOG_LIVE_MS = 50;
/**
 * A dragged token is written at most this often (and once more on drop): the
 * others see it move, without a Firestore write per `pointermove`.
 */
const TOKEN_WRITE_MS = 300;
/** How far the map zooms in, relative to fitting the board. */
const MAX_ZOOM = 4;
/** One click on ＋ / － (and roughly one wheel notch). */
const ZOOM_STEP = 1.25;

/** This viewer's zoom: a scale and a pan, in board pixels. Never shared. */
interface MapView {
  scale: number;
  x: number;
  y: number;
}
const FIT: MapView = { scale: 1, x: 0, y: 0 };

/**
 * The current location's map with draggable combatant tokens. Positions are
 * fractions (0–1) of the *image* (not the letterboxed board), so tokens never
 * drift onto the empty bars. Hidden locations are veiled with {@link MapFog};
 * the GM edits the reveal mask locally with the eraser / fog brush and it is
 * committed once when the tool is released.
 */
export function SessionMap({
  id,
  imageUrl,
  combatants,
  canEdit,
  onMove,
  onDestroyToken,
  fill = false,
  hidden = false,
  reveal,
  fogRole = "player",
  eraserActive = false,
  fogBrushActive = false,
  brushRadius = 0.06,
  onCommitFog,
  onGridReady,
  mapScale,
  showGrid = false,
  realtime = false,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "map" });
  const boardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragId = useRef<string | null>(null);
  // Where dragged tokens are on this screen, ahead of what's been written.
  const moves = useBufferedWrites<{ x: number; y: number }>(
    (combatantId, { x, y }) => onMove(combatantId, x, y),
    // Through a realtime server a message costs nothing: each move goes out,
    // and the token glides for everyone.
    realtime ? { delay: 0 } : { delay: TOKEN_WRITE_MS, maxWait: TOKEN_WRITE_MS },
  );
  /** A token has a menu (to delete it) for the GM only. */
  const hasMenu = () => !!onDestroyToken;
  /** Where the current token press started, and whether it has become a drag. */
  const dragOrigin = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** Token whose menu is open. */
  const [menuId, setMenuId] = useState<string | null>(null);
  const painting = useRef(false);
  const brushing = eraserActive || fogBrushActive;

  const [box, setBox] = useState<ContentBox | null>(null);
  const [view, setView] = useState<MapView>(FIT);
  /** Pointers pressed on the board itself: one pans, two pinch. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; clientX: number; clientY: number; x: number; y: number }
    | { kind: "pinch"; distance: number; scale: number }
    | null
  >(null);
  const [grid, setGrid] = useState<FogGrid>(() => fogGridFor(16 / 9));
  /** Pointer position (image fractions) while a brush tool is active — draws the size preview. */
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);

  const [mask, setMask] = useState<Uint8Array>(() => emptyMask(grid.cols, grid.rows));
  const maskRef = useRef(mask);
  useEffect(() => {
    maskRef.current = mask;
  }, [mask]);
  const dirtyRef = useRef(false);
  const wasBrushingRef = useRef(false);

  /** Pixel rect of the rendered image within the board (accounts for letterbox). */
  const measure = useCallback(() => {
    const rect = boardRef.current?.getBoundingClientRect();
    const img = imgRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const nw = img?.naturalWidth ?? 0;
    const nh = img?.naturalHeight ?? 0;
    if (!nw || !nh) {
      setBox({ left: 0, top: 0, width: rect.width, height: rect.height });
      return;
    }
    const scale = Math.min(rect.width / nw, rect.height / nh);
    const width = nw * scale;
    const height = nh * scale;
    setBox({ left: (rect.width - width) / 2, top: (rect.height - height) / 2, width, height });
    const next = fogGridFor(nw / nh);
    setGrid((prev) => (prev.cols === next.cols && prev.rows === next.rows ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, imageUrl, fill]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(board);
    return () => observer.disconnect();
  }, [measure]);

  // Another map, another view.
  useEffect(() => setView(FIT), [imageUrl]);

  /**
   * Zoom to `scale` keeping the image point under (`px`, `py`) — board pixels —
   * where it is. The pan is clamped so the image always covers its fitted area.
   */
  function zoomAt(scale: number, px: number, py: number) {
    if (!box) return;
    setView((current) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, scale));
      const fx = (px - box.left - current.x) / (box.width * current.scale);
      const fy = (py - box.top - current.y) / (box.height * current.scale);
      return clampView(
        {
          scale: next,
          x: px - box.left - fx * box.width * next,
          y: py - box.top - fy * box.height * next,
        },
        box,
      );
    });
  }

  /** Zoom around the middle of the board (the ＋ / － buttons). */
  function zoomBy(factor: number) {
    if (!box) return;
    zoomAt(view.scale * factor, box.left + box.width / 2, box.top + box.height / 2);
  }

  // The wheel listener is attached once: it reads the latest view through refs.
  const viewRef = useRef(view);
  const zoomAtRef = useRef(zoomAt);
  useEffect(() => {
    viewRef.current = view;
    zoomAtRef.current = zoomAt;
  });

  // The wheel zooms: a trackpad pinch (ctrl + wheel) everywhere, a plain wheel
  // only where the map has the screen to itself — elsewhere it scrolls the page.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !imageUrl) return;
    function onWheel(event: WheelEvent) {
      if (!fill && !event.ctrlKey) return;
      event.preventDefault();
      const rect = board!.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
      zoomAtRef.current(
        viewRef.current.scale * factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    }
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
  }, [fill, imageUrl]);

  useEffect(() => {
    onGridReady?.(grid.cols, grid.rows);
  }, [grid.cols, grid.rows, onGridReady]);

  // Load the persisted mask into the local buffer — unless the GM has
  // uncommitted local edits, which would otherwise be clobbered by the echo.
  useEffect(() => {
    if (painting.current || dirtyRef.current) return;
    const { cols, rows } = grid;
    setMask(
      reveal?.mask && reveal.cols && reveal.rows
        ? resampleMask(
            unpackMask(reveal.mask, reveal.cols, reveal.rows),
            reveal.cols,
            reveal.rows,
            cols,
            rows,
          )
        : emptyMask(cols, rows),
    );
  }, [reveal?.mask, reveal?.cols, reveal?.rows, grid]);

  const commitFog = useCallback(() => {
    if (!onCommitFog || !dirtyRef.current) return;
    dirtyRef.current = false;
    onCommitFog(packMask(maskRef.current), grid.cols, grid.rows);
  }, [onCommitFog, grid.cols, grid.rows]);

  const commitRef = useRef(commitFog);
  useEffect(() => {
    commitRef.current = commitFog;
  });

  // Commit when the eraser / fog brush is put away.
  useEffect(() => {
    if (wasBrushingRef.current && !brushing) commitFog();
    wasBrushingRef.current = brushing;
  }, [brushing, commitFog]);

  // Safety net for long painting sessions — or, through a realtime server,
  // the players watch the fog lift as the GM paints.
  useEffect(() => {
    if (!brushing) return;
    // Through the ref: the parent's callback changes on every render, which
    // would restart the timer before it ever fires.
    const timer = window.setInterval(
      () => commitRef.current(),
      realtime ? FOG_LIVE_MS : AUTOSAVE_MS,
    );
    return () => window.clearInterval(timer);
  }, [brushing, realtime]);

  // Flush on unmount / location change while still dirty.
  useEffect(() => () => commitRef.current(), []);

  /** Where the image is drawn, zoom included: tokens, fog and brush follow it. */
  const shown: ContentBox | null = box && {
    left: box.left + view.x,
    top: box.top + view.y,
    width: box.width * view.scale,
    height: box.height * view.scale,
  };

  function clientToFraction(clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const b = shown ?? { left: 0, top: 0, width: rect.width, height: rect.height };
    if (b.width === 0 || b.height === 0) return null;
    return {
      x: clamp01((clientX - rect.left - b.left) / b.width),
      y: clamp01((clientY - rect.top - b.top) / b.height),
    };
  }

  function paintCell(clientX: number, clientY: number) {
    const fraction = clientToFraction(clientX, clientY);
    if (!fraction) return;
    setMask((prev) => {
      const next = prev.slice();
      const changed = paintDisc(
        next,
        grid.cols,
        grid.rows,
        fraction.x,
        fraction.y,
        brushRadius,
        eraserActive,
      );
      if (changed) dirtyRef.current = true;
      return changed ? next : prev;
    });
  }

  function onPointerDown(event: React.PointerEvent, combatantId: string) {
    if (!canEdit || brushing) return;
    event.preventDefault();
    // A token press is not a pan of the board underneath.
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragId.current = combatantId;
    dragOrigin.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onBoardPointerDown(event: React.PointerEvent) {
    if (canEdit && brushing) {
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      painting.current = true;
      paintCell(event.clientX, event.clientY);
      return;
    }
    // Otherwise the board pans (one finger, once zoomed) or pinches (two).
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    startGesture();
  }

  function startGesture() {
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = {
        kind: "pinch",
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: view.scale,
      };
    } else if (points.length === 1 && view.scale > 1) {
      const [a] = points;
      gesture.current = { kind: "pan", clientX: a.x, clientY: a.y, x: view.x, y: view.y };
    } else {
      gesture.current = null;
    }
  }

  /** Pan or pinch, from the pointers pressed on the board. */
  function moveGesture(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current || !box) return true;
    if (current.kind === "pan") {
      setView((previous) =>
        clampView(
          {
            ...previous,
            x: current.x + event.clientX - current.clientX,
            y: current.y + event.clientY - current.clientY,
          },
          box,
        ),
      );
    } else {
      const [a, b] = [...pointers.current.values()];
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect && a && b) {
        zoomAt(
          (current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / current.distance,
          (a.x + b.x) / 2 - rect.left,
          (a.y + b.y) / 2 - rect.top,
        );
      }
    }
    return true;
  }

  function endGesture(event: React.PointerEvent) {
    if (!pointers.current.delete(event.pointerId)) return;
    startGesture();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (canEdit && brushing) {
      setBrushCursor(clientToFraction(event.clientX, event.clientY));
    }
    if (painting.current) {
      paintCell(event.clientX, event.clientY);
      return;
    }
    if (moveGesture(event)) return;
    if (!dragId.current) return;
    // Ignore pointer jitter so a plain click doesn't nudge the token.
    const origin = dragOrigin.current;
    if (origin && !origin.moved) {
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < CLICK_SLOP) return;
      origin.moved = true;
    }
    const fraction = clientToFraction(event.clientX, event.clientY);
    if (fraction) moves.set(dragId.current, fraction);
  }

  function onPointerUp(event: React.PointerEvent) {
    // Painting stops on release but the mask is committed only when the tool
    // itself is put away (see the `brushing` effect).
    painting.current = false;
    endGesture(event);
    if (dragId.current) {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      // A click (no drag) on a token opens its menu, when it has one.
      const clicked = combatants.find((combatant) => combatant.id === dragId.current);
      if (clicked && hasMenu() && !dragOrigin.current?.moved) {
        setMenuId(clicked.id);
      }
      moves.flush(dragId.current);
      dragId.current = null;
      dragOrigin.current = null;
    }
  }

  if (!imageUrl) {
    return (
      <div
        id={id}
        className={cn(
          "bg-muted/40 text-muted-foreground flex items-center justify-center rounded-md border text-sm",
          fill ? "h-full w-full p-6 text-center" : "aspect-video w-full",
        )}
      >
        {t("noLocation")}
      </div>
    );
  }

  const showFog = hidden;
  const tokenLeft = (x: number) => (shown ? shown.left + x * shown.width : x * 100);
  const tokenTop = (y: number) => (shown ? shown.top + y * shown.height : y * 100);
  const tokenUnit = shown ? "px" : "%";
  // A square on screen, zoom included: tokens follow the map when it zooms.
  const cellPx = shown ? cellSizePx(mapScale, shown.width) : null;

  const board = (
    <div
      id={id}
      ref={boardRef}
      className={cn(
        "relative touch-none overflow-hidden rounded-md border select-none",
        fill ? "h-full w-full" : "w-full",
        canEdit && brushing && "cursor-crosshair",
      )}
      onPointerDown={onBoardPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endGesture}
      onPointerLeave={() => setBrushCursor(null)}
    >
      <img
        id="session-map-image"
        ref={imgRef}
        src={imageUrl}
        alt={t("alt")}
        onLoad={measure}
        className={cn(fill ? "absolute inset-0 h-full w-full object-contain" : "block w-full")}
        style={
          box && view.scale > 1
            ? {
                transformOrigin: `${box.left}px ${box.top}px`,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              }
            : undefined
        }
        draggable={false}
      />

      {showFog && (
        <div
          id="session-fog"
          className="pointer-events-none absolute"
          style={
            shown
              ? { left: shown.left, top: shown.top, width: shown.width, height: shown.height }
              : { inset: 0 }
          }
        >
          <MapFog mask={mask} cols={grid.cols} rows={grid.rows} role={fogRole} animate={!canEdit} />
        </div>
      )}

      {canEdit && brushing && brushCursor && shown && (
        <div
          className="pointer-events-none absolute rounded-full border border-white/90"
          style={{
            left: shown.left + brushCursor.x * shown.width,
            top: shown.top + brushCursor.y * shown.height,
            width: 2 * brushRadius * shown.width,
            height: 2 * brushRadius * shown.width,
            transform: "translate(-50%, -50%)",
            backgroundColor: eraserActive ? "rgba(255,255,255,0.15)" : "rgba(10,10,15,0.3)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          }}
        />
      )}

      {showGrid && shown && cellPx && (
        <div
          id="session-map-grid"
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: shown.left,
            top: shown.top,
            width: shown.width,
            height: shown.height,
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.35) 1px, transparent 1px)",
            backgroundSize: `${cellPx}px ${cellPx}px`,
          }}
        />
      )}

      {combatants
        .filter((combatant) => combatant.onMap)
        .map((combatant) => (
          <Popover
            key={combatant.id}
            open={menuId === combatant.id}
            onOpenChange={(open) => !open && setMenuId(null)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverAnchor asChild>
                  <div
                    id={`session-token-${combatant.id}`}
                    onPointerDown={(event) => onPointerDown(event, combatant.id)}
                    className={
                      "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow " +
                      (canEdit && !brushing ? "cursor-grab active:cursor-grabbing" : "")
                    }
                    style={{
                      left: `${tokenLeft(moves.values[combatant.id]?.x ?? combatant.x)}${tokenUnit}`,
                      top: `${tokenTop(moves.values[combatant.id]?.y ?? combatant.y)}${tokenUnit}`,
                      width: tokenDiameter(combatant.size, cellPx),
                      height: tokenDiameter(combatant.size, cellPx),
                      // The initials grow and shrink with the token.
                      fontSize: Math.max(
                        8,
                        Math.min(18, tokenDiameter(combatant.size, cellPx) * 0.32),
                      ),
                      backgroundColor: combatantColor(combatant),
                    }}
                  >
                    {tokenLabel(combatant.name)}
                  </div>
                </PopoverAnchor>
              </TooltipTrigger>
              <TooltipContent>
                {combatant.name} — {combatant.currentHitPoints}/{combatant.maxHitPoints} PV
              </TooltipContent>
            </Tooltip>
            {onDestroyToken && (
              <PopoverContent
                id={`session-token-menu-${combatant.id}`}
                // A menu just closed hands focus back to its button: that is
                // not the GM leaving this one (a click away or Escape still is).
                onFocusOutside={(event) => event.preventDefault()}
                side="bottom"
                className="grid w-52 gap-1 p-2"
                // React events cross portals: keep menu clicks away from the board's handlers.
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
              >
                <div className="px-2 py-1">
                  <p className="truncate text-sm font-medium">{combatant.name}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {combatant.currentHitPoints}/{combatant.maxHitPoints} PV
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 justify-start"
                  onClick={() => {
                    setMenuId(null);
                    onDestroyToken(combatant.id);
                  }}
                >
                  <Trash2Icon /> {t("deleteToken")}
                </Button>
              </PopoverContent>
            )}
          </Popover>
        ))}

      <div
        id="session-map-zoom"
        className="bg-background/80 absolute right-2 bottom-2 flex gap-0.5 rounded-md border p-0.5 shadow-sm backdrop-blur"
        // Its own clicks, not a pan or a brush stroke on the board.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("zoomOut")}
          disabled={view.scale <= 1}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          <ZoomOutIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("zoomIn")}
          disabled={view.scale >= MAX_ZOOM}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <ZoomInIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("zoomFit")}
          disabled={view.scale <= 1}
          onClick={() => setView(FIT)}
        >
          <MaximizeIcon className="size-4" />
        </Button>
      </div>
    </div>
  );

  if (!fill) return board;
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
      {board}
    </div>
  );
}

/** Keep the zoomed image over its fitted area: no empty band slides into view. */
function clampView(view: MapView, box: ContentBox): MapView {
  if (view.scale <= 1) return FIT;
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  return {
    scale: view.scale,
    x: clamp(view.x, box.width * (1 - view.scale)),
    y: clamp(view.y, box.height * (1 - view.scale)),
  };
}
