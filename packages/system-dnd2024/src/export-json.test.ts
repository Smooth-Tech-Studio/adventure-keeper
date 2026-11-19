import { describe, expect, it } from "vitest";
import { CATALOG_SCHEMA_VERSION, catalogExport, catalogJson } from "./export-json";

/**
 * The guided creation was built on one promise: « au jour J, l'export JSON est
 * un `JSON.stringify`, pas une réécriture ». These tests are how we find out
 * whether that promise survived eighteen months of catalogue writing — a single
 * function, `Date`, `undefined` or `Map` slipped into a description module and
 * the round-trip stops being lossless.
 */
describe("export JSON des catalogues", () => {
  const exported = catalogExport();

  it("fait un aller-retour sans rien perdre", () => {
    const round = JSON.parse(catalogJson()) as unknown;
    expect(round).toEqual(exported);
  });

  it("ne contient que des données — ni fonction, ni classe, ni date", () => {
    const offenders: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (value === null) return;
      const type = typeof value;
      if (type === "function" || type === "symbol" || type === "bigint") {
        offenders.push(`${path} → ${type}`);
        return;
      }
      if (type !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      // A plain object has Object.prototype; anything else is an instance.
      const record = value as Record<string, unknown>;
      const proto = Object.getPrototypeOf(record) as object | null;
      if (proto !== Object.prototype && proto !== null) {
        offenders.push(`${path} → ${record.constructor?.name ?? "instance"}`);
        return;
      }
      for (const [key, inner] of Object.entries(record)) walk(inner, `${path}.${key}`);
    };
    walk(exported, "catalogues");
    expect(offenders).toEqual([]);
  });

  it("n'écrit pas « undefined », qui disparaîtrait à la sérialisation", () => {
    // `JSON.stringify` drops an undefined property silently, so the round-trip
    // above would pass while the data quietly changed shape.
    const dropped: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value !== "object" || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (inner === undefined) dropped.push(`${path}.${key}`);
        else walk(inner, `${path}.${key}`);
      }
    };
    walk(exported, "catalogues");
    expect(dropped).toEqual([]);
  });

  it("porte tout ce qu'une fiche lit", () => {
    expect(exported.system).toBe("dnd2024");
    expect(exported.schemaVersion).toBe(CATALOG_SCHEMA_VERSION);
    expect(exported.classes).toHaveLength(12);
    expect(exported.species).toHaveLength(9);
    expect(exported.backgrounds).toHaveLength(5);
    expect(exported.subclasses).toHaveLength(12);
    expect(exported.feats).toHaveLength(19);
    expect(Object.keys(exported.startingEquipment.classes)).toHaveLength(12);
    expect(Object.keys(exported.startingEquipment.backgrounds)).toHaveLength(5);
  });

  it("produit un JSON d'une taille raisonnable pour un fichier livré", () => {
    const compact = catalogJson(0);
    expect(compact.length).toBeGreaterThan(20_000);
    expect(compact.length).toBeLessThan(500_000);
  });
});
