import { describe, expect, it } from "vitest";
import {
  ABILITIES_BY_LABEL,
  ABILITY_LABELS,
  CONDITIONS_BY_LABEL,
  CONDITION_LABELS,
  SKILLS,
  SKILLS_BY_LABEL,
  SKILL_LABELS,
  withLocale,
} from "@/systems/dnd2024/vocabulary";

import { compareText, sortedByLabel } from "./sort";

describe("sortedByLabel", () => {
  it("sorts alphabetically without regard to accents or case", () => {
    const names = ["Zèbre", "épée", "Arc", "Bâton", "dague"];
    expect(sortedByLabel(names, (name) => name)).toEqual([
      "Arc",
      "Bâton",
      "dague",
      "épée",
      "Zèbre",
    ]);
  });

  it("does not mutate its input", () => {
    const input = ["b", "a"];
    sortedByLabel(input, (name) => name);
    expect(input).toEqual(["b", "a"]);
  });
});

describe("alphabetical lists of the rules package", () => {
  it("skills are sorted by French label and none is lost", () => {
    const labels = SKILLS_BY_LABEL.map((skill) => SKILL_LABELS[skill]);
    expect(labels).toEqual([...labels].sort(compareText));
    expect([...SKILLS_BY_LABEL].sort()).toEqual([...SKILLS].sort());
  });

  it("abilities are sorted by French label", () => {
    const labels = withLocale("fr", () =>
      ABILITIES_BY_LABEL.map((ability) => ABILITY_LABELS[ability]),
    );
    expect(labels).toEqual([
      "Charisme",
      "Constitution",
      "Dextérité",
      "Force",
      "Intelligence",
      "Sagesse",
    ]);
  });

  it("conditions are sorted by French label", () => {
    const labels = CONDITIONS_BY_LABEL.map((condition) => CONDITION_LABELS[condition]);
    expect(labels).toEqual([...labels].sort(compareText));
  });
});
