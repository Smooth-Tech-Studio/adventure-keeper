import { createContext, useContext, useEffect } from "react";

/**
 * One step of the trail shown under the navbar. The last crumb is the current
 * page and is never a link; `label` is undefined while its name is loading.
 */
export interface Crumb {
  label: string | undefined;
  to?: string;
}

export const BreadcrumbsContext = createContext<Crumb[] | null>(null);
// The setter lives in its own context so a page publishing its trail does not
// re-render (and re-publish) every time the trail changes.
export const SetBreadcrumbsContext = createContext<((crumbs: Crumb[] | null) => void) | undefined>(
  undefined,
);

/** The trail published by the current page, for the bar in the root layout. */
export function useBreadcrumbsValue(): Crumb[] | null {
  return useContext(BreadcrumbsContext);
}

/**
 * Publish the current page's trail. Pages that don't call it get no bar
 * (top-level pages, whose place the navbar already shows).
 */
export function useBreadcrumbs(crumbs: Crumb[]) {
  const setCrumbs = useContext(SetBreadcrumbsContext);
  if (!setCrumbs) throw new Error("useBreadcrumbs must be used within a BreadcrumbsProvider");
  // Callers pass a fresh array each render: compare by content.
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(JSON.parse(key) as Crumb[]);
  }, [key, setCrumbs]);
  useEffect(() => () => setCrumbs(null), [setCrumbs]);
}

/**
 * Links that open a page from somewhere other than its usual parent pass the
 * trail they come from in `state.from`, so the bar shows the path the user
 * actually took (a character sheet opened from a campaign, say).
 */
export function crumbsFromState(state: unknown): Crumb[] | undefined {
  const from = (state as { from?: unknown } | null)?.from;
  if (!Array.isArray(from)) return undefined;
  const valid = from.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as Crumb).label === "string" &&
      typeof (c as Crumb).to === "string" &&
      (c as Crumb).to!.startsWith("/"),
  );
  return valid && from.length > 0 ? (from as Crumb[]) : undefined;
}
