import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept up to date — for a layout whose
 * structure (not just its styling) changes with the screen, like the player's
 * session view: tabs on a phone, map and sheet side by side on a computer.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
