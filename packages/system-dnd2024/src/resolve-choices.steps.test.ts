import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import { CLASS_IDS } from "./classes";
import { CHOICE_SOURCES, choiceStep } from "./choices";
import { resolveChoices } from "./resolve-choices";
import { SPECIES_IDS } from "./species";

/**
 * The steps the wizard declares, mirrored here. The wizard renders a choice
 * only if its `choiceStep()` is on some step — anything else is unreachable,
 * which is exactly the bug these tests exist to prevent.
 */
const STEP_SOURCES = ["class", "subclass", "species", "background", "level"] as const;

describe("every choice reaches a step", () => {
  it("covers all of CHOICE_SOURCES except « feat », which routes via its granter", () => {
    const uncovered = CHOICE_SOURCES.filter(
      (source) => source !== "feat" && !STEP_SOURCES.includes(source as never),
    );
    expect(uncovered).toEqual([]);
  });

  it("leaves no choice stranded, for every class / species / background at level 1", () => {
    const stranded: string[] = [];
    for (const classId of CLASS_IDS) {
      for (const speciesId of SPECIES_IDS) {
        for (const background of BACKGROUNDS) {
          const defs = resolveChoices({
            classId,
            speciesId,
            backgroundId: background.id,
            level: 1,
          });
          for (const def of defs) {
            if (!STEP_SOURCES.includes(choiceStep(def) as never)) {
              stranded.push(`${classId}/${speciesId}/${background.id} → ${def.id}`);
            }
          }
        }
      }
    }
    expect(stranded.slice(0, 10)).toEqual([]);
  });

  it("routes a feat's own picks to the step that granted the feat", () => {
    // Acolyte grants « Initié à la magie (clerc) » — its spells belong to the
    // background step, not to a step that does not exist.
    const acolyte = resolveChoices({ classId: "fighter", backgroundId: "acolyte", level: 1 });
    const spells = acolyte.filter((def) => def.id.startsWith("feat:magic-initiate-cleric:"));
    expect(spells.length).toBe(3);
    for (const def of spells) expect(choiceStep(def)).toBe("background");

    // The Human's « Polyvalent » feat, and whatever it brings, sit on the species step.
    const human = resolveChoices({
      classId: "fighter",
      speciesId: "human",
      backgroundId: "soldier",
      level: 1,
      picks: [{ choiceId: "species:human:origin-feat", values: ["skilled"] }],
    });
    const grant = human.find((def) => def.id === "species:human:origin-feat");
    expect(grant?.label).toBe("Polyvalent");
    expect(choiceStep(human.find((def) => def.id === "feat:skilled:proficiencies")!)).toBe(
      "species",
    );

    // A feat taken at a level slot shows its picks on the ability step.
    const l4 = resolveChoices({
      classId: "fighter",
      backgroundId: "soldier",
      level: 4,
      picks: [{ choiceId: "level:4:feat", values: ["ritual-caster"] }],
    });
    expect(choiceStep(l4.find((def) => def.id === "level:4:feat")!)).toBe("level");
  });

  it("opens the level-4 tier feat for every class", () => {
    for (const classId of CLASS_IDS) {
      const defs = resolveChoices({ classId, backgroundId: "soldier", level: 4 });
      expect(
        defs.some((def) => def.source === "level" && def.kind === "option"),
        classId,
      ).toBe(true);
    }
  });
});
