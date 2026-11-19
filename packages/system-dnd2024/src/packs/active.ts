/**
 * Which content packs the lookups (`getSpecies`, `getFeat`, `subclassesFor`…)
 * see on top of the SRD.
 *
 * Every engine function is synchronous, so a computation can be run *with* a
 * set of packs and restored afterwards ({@link withContent}) — no need to thread
 * a parameter through the thirty helpers that read content. The UI sets a
 * default for the screen it shows with {@link setActiveContent}.
 *
 * This module imports types only, so the content modules can read it without
 * an import cycle.
 */

import type { ContentOverlay } from "./registry";

let active: ContentOverlay | null = null;

/** The packs the lookups currently see, or `null` for the SRD alone. */
export function activeContent(): ContentOverlay | null {
  return active;
}

/** Make `content` the default for every lookup until changed (`null` = SRD only). */
export function setActiveContent(content: ContentOverlay | null): void {
  active = content;
}

/**
 * Run `fn` with `content` active, then restore what was active before — even
 * if `fn` throws. `fn` must be synchronous: anything it awaits would run after
 * the restore.
 */
export function withContent<T>(content: ContentOverlay | null, fn: () => T): T {
  const previous = active;
  active = content;
  try {
    return fn();
  } finally {
    active = previous;
  }
}
