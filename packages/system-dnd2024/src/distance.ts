import { locale } from "./locale";
/**
 * Distances, shown the way the rulebook of the engine's locale writes them:
 * metres in French, feet in English.
 *
 * The data stores feet, because that is the unit the rules are designed in —
 * every range is a multiple of 5 ft and the grid is 5 ft a square. The French
 * edition prints metres, on a flat 5 ft = 1,50 m conversion, so a speed of
 * 30 ft reads « 9 m » and a Goliath's 35 ft reads « 10,50 m ».
 *
 * Converting at display time keeps one unit in the data and one unit on screen.
 */

/** Metres for a distance in feet, on the rulebook's 5 ft = 1,50 m scale. */
export function feetToMetres(feet: number): number {
  return (feet / 5) * 1.5;
}

/** Feet for a distance in metres — the inverse, for data kept in metres (an enemy's speed). */
export function metresToFeet(metres: number): number {
  return Math.round((metres / 1.5) * 5);
}

/**
 * A distance in feet, written as the book writes it — in English « 30 ft »;
 * in French, in metres: « 9 m »,
 * « 10,50 m », « 1,50 m » — comma for the decimal mark, two decimals or none.
 */
export function formatDistance(feet: number): string {
  if (locale() === "en") return `${feet} ft`;
  const metres = feetToMetres(feet);
  const text = Number.isInteger(metres) ? String(metres) : metres.toFixed(2).replace(".", ",");
  return `${text} m`;
}

/**
 * A weight stored in kilograms, written for the engine's locale: « 1,5 kg »
 * in French, pounds in English on the rulebooks' 1 lb = 0,5 kg scale (« 3 lb »).
 */
export function formatWeight(kg: number): string {
  if (locale() === "en") {
    const pounds = Math.round(kg * 2 * 100) / 100;
    return `${pounds} lb`;
  }
  return `${String(Math.round(kg * 100) / 100).replace(".", ",")} kg`;
}
