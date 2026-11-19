import { describe, expect, it } from "vitest";
import { canonicalLineage, getLineage, getSpecies } from "./species";

/**
 * A lineage name is a value stored on the sheet (`speciesChoice`). When the
 * rulebook check moved « Elfe des bois » to « Elfe sylvestre » and
 * « Chthonien » to « Chtonien », every character already saved kept the old
 * spelling — so both have to resolve, for ever.
 */
describe("renommage des lignages", () => {
  it("propose désormais les noms du livre", () => {
    expect(getSpecies("elf")?.choice?.options).toContain("Elfe sylvestre");
    expect(getSpecies("elf")?.choice?.options).not.toContain("Elfe des bois");
    expect(getSpecies("tiefling")?.choice?.options).toContain("Chtonien");
  });

  it("résout encore une fiche enregistrée sous l'ancien nom", () => {
    expect(getLineage("elf", "Elfe des bois")).toBeDefined();
    expect(getLineage("elf", "Elfe des bois")).toEqual(getLineage("elf", "Elfe sylvestre"));
    expect(getLineage("tiefling", "Chthonien")).toEqual(getLineage("tiefling", "Chtonien"));
  });

  it("traduit l'ancien nom vers le nouveau, et laisse le reste intact", () => {
    expect(canonicalLineage("Elfe des bois")).toBe("Elfe sylvestre");
    expect(canonicalLineage("Chthonien")).toBe("Chtonien");
    expect(canonicalLineage("Drow")).toBe("Drow");
    expect(canonicalLineage(undefined)).toBeUndefined();
  });

  it("garde la vitesse de l'elfe sylvestre des deux côtés du renommage", () => {
    expect(getLineage("elf", "Elfe des bois")?.speed).toBe(35);
    expect(getLineage("elf", "Elfe sylvestre")?.speed).toBe(35);
  });
});
