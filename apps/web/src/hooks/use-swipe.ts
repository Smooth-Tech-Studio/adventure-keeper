import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * A sideways swipe on an element: spread the returned handlers on it, and give
 * it `touch-pan-y` so the browser keeps vertical scrolling and leaves the
 * sideways drag to us (otherwise it cancels the pointer as a scroll).
 *
 * A mostly vertical move is a scroll, not a swipe. The click that ends a swipe
 * is swallowed, so a swipe started on a button does not also press it.
 */
export function useSwipe(
  onSwipe: (direction: 1 | -1) => void,
  { touchOnly = false, threshold = 50 }: { touchOnly?: boolean; threshold?: number } = {},
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return {
    onPointerDown(event: PointerEvent) {
      // On a computer, a mouse drag selects text: only touch swipes then.
      if (touchOnly && event.pointerType === "mouse") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      start.current = { x: event.clientX, y: event.clientY };
      swiped.current = false;
    },
    onPointerUp(event: PointerEvent) {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped.current = true;
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel() {
      start.current = null;
    },
    onClickCapture(event: MouseEvent) {
      if (!swiped.current) return;
      swiped.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
