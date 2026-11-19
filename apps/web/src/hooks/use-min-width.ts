import { useEffect, useRef, useState } from "react";

/**
 * Whether the referenced element is at least `minWidth` px wide, tracked as it
 * resizes — for a block whose behaviour (not just its CSS) follows the room it
 * gets, where a container query alone can't reach.
 */
export function useMinWidth<T extends HTMLElement>(minWidth: number) {
  const ref = useRef<T>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= minWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [minWidth]);
  return [ref, wide] as const;
}
