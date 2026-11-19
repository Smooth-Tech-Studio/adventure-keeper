import { describe, expect, it } from "vitest";

import {
  deriveFormState,
  emptyState,
  type FormState,
} from "@/systems/dnd2024/character-form/state";
import { originImpact } from "@/systems/dnd2024/creation-wizard/impact";

const elf: FormState = {
  ...emptyState(),
  name: "Isolde",
  classId: "wizard",
  speciesId: "elf",
  speciesChoice: "Haut-elfe",
  backgroundId: "sage",
  level: 3,
  base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  bonuses: { str: 0, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
  choices: [{ choiceId: "species:elf:skill", values: ["perception"] }],
  speciesSkillProficiencies: ["perception"],
};
const human: FormState = {
  ...elf,
  speciesId: "human",
  speciesChoice: "",
  choices: [],
  speciesSkillProficiencies: [],
};

const impact = originImpact(elf, human, deriveFormState(elf), deriveFormState(human), (id) => id);
const labels = (lines: { label: string }[]) => lines.map((line) => line.label);

describe("originImpact", () => {
  it("lists what an elf loses by becoming human, and what comes with it", () => {
    expect(labels(impact.lost)).toEqual(
      expect.arrayContaining(["Transe", "Ascendance féerique", "Perception", "prestidigitation"]),
    );
    expect(labels(impact.gained)).toEqual(expect.arrayContaining(["Ingénieux"]));
  });

  it("keeps the class, the background and the equipment", () => {
    expect(labels(impact.kept)).toEqual(
      expect.arrayContaining(["Classe", "Historique", "Équipement et bourse"]),
    );
    expect(labels(impact.lost)).not.toContain("Incantation");
  });

  it("shows the numbers that move", () => {
    expect(impact.numbers.map(([label]) => label)).toEqual(
      expect.arrayContaining(["Vision dans le noir", "Perception passive"]),
    );
  });
});
