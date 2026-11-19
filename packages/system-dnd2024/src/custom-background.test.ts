import { describe, expect, it } from "vitest";
import { getBackground } from "./backgrounds";
import { choiceStep } from "./choices";
import { heldFeatIds, resolveChoices } from "./resolve-choices";
import { validateBackgroundBonuses } from "./character-rules";

const base = { classId: "fighter", speciesId: "dwarf", level: 1 } as const;
const custom = (picks: { choiceId: string; values: string[] }[] = []) =>
  resolveChoices({ ...base, backgroundId: "custom", picks });

/**
 * A custom background grants nothing outright. Every absence on its
 * `BackgroundDef` becomes a pick, which is the whole reason the generic
 * `Choice` model was built.
 */
describe("historique personnalisé", () => {
  it("n'accorde rien d'office", () => {
    const def = getBackground("custom")!;
    expect(def.skillProficiencies).toBeUndefined();
    expect(def.toolProficiency).toBeUndefined();
    expect(def.originFeatId).toBeUndefined();
  });

  it("ouvre les quatre choix que les seize autres accordent", () => {
    const ids = custom().map((def) => def.id);
    expect(ids).toContain("background:custom:skills");
    expect(ids).toContain("background:custom:tool");
    expect(ids).toContain("background:custom:origin-feat");
    expect(ids).toContain("background:custom:equipment");
  });

  it("demande deux compétences et un seul outil", () => {
    const defs = custom();
    expect(defs.find((def) => def.id === "background:custom:skills")?.count).toBe(2);
    expect(defs.find((def) => def.id === "background:custom:tool")?.count).toBe(1);
  });

  it("montre ces choix sur l'étape de l'historique", () => {
    for (const def of custom().filter((d) => d.id.startsWith("background:custom:"))) {
      expect(choiceStep(def), def.id).toBe("background");
    }
  });

  it("laisse placer le +2/+1 sur n'importe quelle caractéristique", () => {
    const spread = { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 };
    expect(validateBackgroundBonuses("custom", spread).valid).toBe(true);
    const mental = { str: 0, dex: 0, con: 0, int: 2, wis: 1, cha: 0 };
    expect(validateBackgroundBonuses("custom", mental).valid).toBe(true);
  });

  it("refuse encore une répartition qui n'est pas +2/+1 ou +1/+1/+1", () => {
    const bad = { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    expect(validateBackgroundBonuses("custom", bad).valid).toBe(false);
  });

  it("tient le don choisi, et en ouvre les choix internes", () => {
    const picks = [{ choiceId: "background:custom:origin-feat", values: ["skilled"] }];
    expect(heldFeatIds({ ...base, backgroundId: "custom", picks })).toContain("skilled");
    // Doué brings three proficiencies of its own, shown with the background.
    const inner = custom(picks).find((def) => def.id === "feat:skilled:proficiencies");
    expect(inner?.count).toBe(3);
    expect(choiceStep(inner!)).toBe("background");
  });

  it("laisse les seize historiques du livre accorder les leurs", () => {
    const acolyte = resolveChoices({ ...base, backgroundId: "acolyte" }).map((def) => def.id);
    expect(acolyte).not.toContain("background:acolyte:skills");
    expect(acolyte).not.toContain("background:acolyte:origin-feat");
    expect(heldFeatIds({ ...base, backgroundId: "acolyte" })).toContain("magic-initiate-cleric");
  });
});
