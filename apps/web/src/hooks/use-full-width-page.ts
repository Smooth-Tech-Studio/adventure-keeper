import { createContext, useContext, useEffect } from "react";

/**
 * A page that fills the whole window, edge to edge (the guided character
 * creation), asks the chrome to step aside: no breadcrumbs bar, so it sits
 * right under the navbar, and no footer, so it ends on its own action bar.
 */
export const FullWidthPageContext = createContext(false);
export const SetFullWidthPageContext = createContext<((value: boolean) => void) | undefined>(
  undefined,
);

/** For the root layout: whether the current page asked for the full width. */
export function useFullWidthPageValue(): boolean {
  return useContext(FullWidthPageContext);
}

/** Ask for the full-width chrome while `enabled` and this page is mounted. */
export function useFullWidthPage(enabled = true) {
  const setFullWidth = useContext(SetFullWidthPageContext);
  if (!setFullWidth)
    throw new Error("useFullWidthPage must be used within a FullWidthPageProvider");
  useEffect(() => {
    if (!enabled) return;
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [enabled, setFullWidth]);
}
