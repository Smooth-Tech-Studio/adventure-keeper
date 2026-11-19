import type { MapScale } from "@adventure-keeper/schemas";
import type { CreatureSize } from "@/systems/dnd2024/vocabulary";

/** A square of the grid: 5 ft. */
export const SQUARE_METRES = 1.5;

/** Squares a creature's token spans, side to side (2024: Tiny shares a square). */
export const SIZE_SQUARES: Record<CreatureSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

/** Without a scale: a Medium token's diameter, and how the others compare. */
const BASE_TOKEN_PX = 32;
const UNSCALED_FACTOR: Record<CreatureSize, number> = {
  tiny: 0.7,
  small: 0.9,
  medium: 1,
  large: 1.5,
  huge: 2,
  gargantuan: 2.5,
};
/** Below this a token can no longer be grabbed nor read. */
export const MIN_TOKEN_PX = 12;

type Point = MapScale["from"];

/**
 * The scale from two points on an image (fractions of its width and height),
 * the real distance between them and the image's natural size; `null` when
 * the points coincide or the distance is not a positive number.
 */
export function scaleFromPoints(
  from: Point,
  to: Point,
  metres: number,
  naturalWidth: number,
  naturalHeight: number,
): MapScale | null {
  const pixels = Math.hypot((to.x - from.x) * naturalWidth, (to.y - from.y) * naturalHeight);
  if (!(metres > 0) || pixels < 1 || naturalWidth <= 0) return null;
  return { from, to, metres, widthMetres: (naturalWidth * metres) / pixels };
}

/** How many squares of 1,5 m the map's width holds. */
export const squaresAcross = (scale: Pick<MapScale, "widthMetres">) =>
  scale.widthMetres / SQUARE_METRES;

/** A square's side in screen pixels, for a map drawn `mapWidthPx` wide. */
export function cellSizePx(
  scale: Pick<MapScale, "widthMetres"> | undefined,
  mapWidthPx: number,
): number | null {
  return scale && mapWidthPx > 0 ? mapWidthPx / squaresAcross(scale) : null;
}

/**
 * A token's diameter in pixels: its creature's squares at the map's scale (a
 * hair smaller, so two neighbours do not touch), or a fixed size relative to
 * Medium when the map has no scale.
 */
export function tokenDiameter(size: CreatureSize | undefined, cellPx: number | null): number {
  const s = size ?? "medium";
  if (cellPx === null) return BASE_TOKEN_PX * UNSCALED_FACTOR[s];
  return Math.max(MIN_TOKEN_PX, cellPx * SIZE_SQUARES[s] * 0.92);
}
