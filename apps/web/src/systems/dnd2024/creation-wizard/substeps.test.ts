import { describe, expect, it } from "vitest";
import {
  choiceStep,
  createContentOverlay,
  parseContentPack,
  setActiveContent,
  getBackground,
  getClass,
  getSpecies,
  resolveChoices,
} from "@adventure-keeper/system-dnd2024";

import brumesDuNord from "../../../../../../packages/system-dnd2024/src/packs/fixtures/brumes-du-nord.json";
import { emptyState, type FormState } from "@/systems/dnd2024/character-form/state";
import { CREATION_STEPS, stepAt } from "@/systems/dnd2024/creation-wizard/steps";
import {
  LANGUAGES_TO_PICK,
  languagesToPick,
  buildSubsteps,
  chosenLanguages,
  groupChoiceDefs,
  substepIssues,
  type Substep,
} from "@/systems/dnd2024/creation-wizard/substeps";

function subsFor(stepId: string, patch: Partial<FormState>): Substep[] {
  const state = { ...emptyState(), ...patch };
  const step = CREATION_STEPS.find((entry) => entry.id === stepId)!;
  const defs = resolveChoices({
    classId: state.classId || undefined,
    speciesId: state.speciesId || undefined,
    backgroundId: state.backgroundId || undefined,
    level: state.level,
    picks: state.choices,
  });
  return buildSubsteps(step, {
    state,
    stepDefs: defs.filter((def) => step.sources?.includes(choiceStep(def))),
    klass: state.classId ? getClass(state.classId) : undefined,
    species: state.speciesId ? getSpecies(state.speciesId) : undefined,
    background: state.backgroundId ? getBackground(state.backgroundId) : undefined,
  });
}

const keys = (subs: Substep[]) => subs.map((sub) => sub.key);

describe("buildSubsteps", () => {
  it("shows only the carousel until the class is picked", () => {
    expect(keys(subsFor("class", {}))).toEqual(["pick"]);
  });

  it("asks one question per class choice, equipment last", () => {
    expect(keys(subsFor("class", { classId: "fighter" }))).toEqual([
      "pick",
      "identity",
      "class:fighter:skills",
      "class:fighter:fighting-style",
      "class:fighter:equipment",
      "masteries",
      "features",
    ]);
  });

  it("asks for Expertise on the class step, right after the class's skills", () => {
    const rogue = keys(subsFor("class", { classId: "rogue" }));
    expect(rogue.indexOf("expertise")).toBe(rogue.indexOf("class:rogue:skills") + 1);
    expect(keys(subsFor("background", { classId: "rogue", backgroundId: "sage" }))).not.toContain(
      "expertise",
    );
    expect(keys(subsFor("class", { classId: "bard" }))).not.toContain("expertise");
    expect(keys(subsFor("class", { classId: "bard", level: 2 }))).toContain("expertise");
  });

  it("adds the subclass once the level reaches it", () => {
    expect(keys(subsFor("class", { classId: "wizard", level: 3 }))).toContain(
      "class:wizard:subclass",
    );
    expect(keys(subsFor("class", { classId: "wizard", level: 2 }))).not.toContain(
      "class:wizard:subclass",
    );
  });

  it("keeps a feat's own picks on one screen, under the step that granted it", () => {
    const subs = subsFor("background", { backgroundId: "acolyte" });
    expect(keys(subs)).toEqual([
      "pick",
      "feat:magic-initiate-cleric",
      "background:acolyte:equipment",
      "alignment",
      "languages",
      "lore",
    ]);
    expect(subs[1].defs?.map((def) => def.id)).toEqual([
      "feat:magic-initiate-cleric:cantrips",
      "feat:magic-initiate-cleric:spell",
      "feat:magic-initiate-cleric:ability",
    ]);
  });

  it("goes straight to the traits for a species with nothing to choose", () => {
    expect(keys(subsFor("species", { speciesId: "dwarf" }))).toEqual(["pick", "traits"]);
  });

  it("puts the level feats between the bonuses and the recap", () => {
    expect(keys(subsFor("abilities", { classId: "fighter", level: 4 }))).toEqual([
      "method",
      "values",
      "bonus",
      "hit-points",
      "level:4:feat",
      "recap",
    ]);
  });

  it("ends on the review", () => {
    expect(keys(subsFor("shop", {})).at(-1)).toBe("review");
  });
});

describe("hit points sub-step", () => {
  it("is asked only beyond level 1, before the recap", () => {
    const at = (level: number) => keys(subsFor("abilities", { classId: "fighter", level }));
    expect(at(1)).not.toContain("hit-points");
    expect(at(3).slice(-2)).toEqual(["hit-points", "recap"]);
  });
});

describe("groupChoiceDefs", () => {
  it("moves equipment after everything else", () => {
    const defs = resolveChoices({ classId: "bard", level: 1 });
    expect(groupChoiceDefs(defs).at(-1)?.key).toBe("class:bard:equipment");
  });
});

describe("substepIssues", () => {
  const issues = (sub: Substep, patch: Partial<FormState>, stepId = "background") =>
    substepIssues(sub, stepAt(CREATION_STEPS.findIndex((step) => step.id === stepId) + 1), {
      state: { ...emptyState(), ...patch },
      choiceErrors: {},
    });

  it("does not count the languages the species already grants", () => {
    const sub = subsFor("background", { backgroundId: "sage" }).find(
      (entry) => entry.key === "languages",
    )!;
    // Elvish comes with the elf: picking it changes nothing.
    const state = { speciesId: "elf", languages: ["elvish", "giant"] } as Partial<FormState>;
    expect(chosenLanguages({ ...emptyState(), ...state })).toEqual(["giant"]);
    expect(issues(sub, state)).toHaveLength(1);
    expect(
      issues(sub, { ...state, languages: ["giant", "orc"] } as Partial<FormState>),
    ).toHaveLength(0);
    expect(LANGUAGES_TO_PICK).toBe(2);
  });

  it("asks a rogue for one more language, Thieves' Cant aside", () => {
    const sub = subsFor("background", { classId: "rogue", backgroundId: "sage" }).find(
      (entry) => entry.kind === "languages",
    )!;
    const rogue = (languages: string[]) =>
      issues(sub, { classId: "rogue", languages } as Partial<FormState>, "background");
    expect(languagesToPick({ classId: "rogue" })).toBe(3);
    expect(rogue(["thievesCant", "giant", "orc"])).toHaveLength(1);
    expect(rogue(["giant", "orc", "elvish"])).toHaveLength(0);
  });

  it("asks for a name before leaving the identity screen", () => {
    const sub = subsFor("class", { classId: "rogue" }).find((entry) => entry.kind === "identity")!;
    expect(issues(sub, {}, "class")).toHaveLength(1);
    expect(issues(sub, { name: "Ysolde" }, "class")).toHaveLength(0);
  });

  it("wants every Expertise slot, among proficient skills only", () => {
    const sub = subsFor("class", { classId: "rogue" }).find((entry) => entry.kind === "expertise")!;
    const check = (skillExpertise: string[]) =>
      substepIssues(sub, stepAt(1), {
        state: { ...emptyState(), classId: "rogue", skillExpertise } as FormState,
        choiceErrors: {},
        proficientSkills: ["stealth", "arcana", "history"],
      }).map((issue) => issue.message);
    expect(check(["stealth"])).toEqual(["Expertise : 1 sur 2."]);
    expect(check(["stealth", "arcana"])).toEqual([]);
    expect(check(["stealth", "athletics"])).toHaveLength(1);
  });

  it("asks for every mastery, carried weapon or not", () => {
    const sub = subsFor("class", { classId: "fighter" }).find(
      (entry) => entry.kind === "masteries",
    )!;
    const check = (weaponMasteries: string[]) =>
      substepIssues(sub, stepAt(1), {
        state: { ...emptyState(), classId: "fighter", weaponMasteries } as FormState,
        choiceErrors: {},
      });
    // Fighter 1: three masteries, whatever the kit holds (the gold included).
    expect(check([])).toHaveLength(1);
    expect(check(["longsword", "shortbow"])).toHaveLength(1);
    expect(check(["longsword", "shortbow", "flail"])).toEqual([]);
  });

  it("refuses to leave the carousel empty-handed", () => {
    const pick = subsFor("species", {})[0];
    expect(issues(pick, {}, "species")[0].message).toMatch(/espèce/);
  });
});

describe("choix ouverts par un paquetage", () => {
  it("restent sur l'écran du paquetage, sous lui", () => {
    const parsed = parseContentPack(brumesDuNord);
    if (!parsed.ok) throw new Error("fixture invalide");
    setActiveContent(createContentOverlay([parsed.pack]));
    try {
      const id = "brumes-du-nord:veilleur";
      const defs = resolveChoices({
        backgroundId: id,
        level: 1,
        picks: [{ choiceId: `background:${id}:equipment`, values: ["a"] }],
      });
      const groups = groupChoiceDefs(defs);
      expect(groups.at(-1)?.defs.map((def) => def.id)).toEqual([
        `background:${id}:equipment`,
        `background:${id}:jeu`,
      ]);
    } finally {
      setActiveContent(null);
    }
  });
});
