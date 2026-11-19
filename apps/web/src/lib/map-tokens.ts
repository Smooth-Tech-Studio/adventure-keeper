/** A token's place on the map, in fractions (0–1) of its width and height. */
export interface MapPoint {
  x: number;
  y: number;
}

/** Steps between two candidate places, as a fraction of the map. */
const STEP = 0.06;
/** Closer than this, two tokens hide each other. */
const MIN_GAP = 0.045;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where to drop a new token: `around` (the map's centre by default) if it is
 * free, else the nearest free place on rings around it — so tokens placed one
 * after another do not pile up on the same spot. A familiar is dropped around
 * its character's token.
 */
export function freeSpot(taken: MapPoint[], around: MapPoint = { x: 0.5, y: 0.5 }): MapPoint {
  const free = (p: MapPoint) => taken.every((t) => Math.hypot(t.x - p.x, t.y - p.y) >= MIN_GAP);
  const centre = around;
  if (free(centre)) return centre;
  for (let ring = 1; ring <= 6; ring += 1) {
    const count = ring * 6;
    for (let i = 0; i < count; i += 1) {
      const angle = (2 * Math.PI * i) / count;
      const spot = {
        x: clamp01(centre.x + Math.cos(angle) * ring * STEP),
        y: clamp01(centre.y + Math.sin(angle) * ring * STEP),
      };
      if (free(spot)) return spot;
    }
  }
  return centre;
}
