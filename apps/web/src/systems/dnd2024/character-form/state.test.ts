import { describe, expect, it } from "vitest";

import {
  characterToState,
  emptyState,
  validateForm,
  formStateToDraftInput,
  masteryKinds,
  withChoiceFields,
  type FormState,
} from "@/systems/dnd2024/character-form/state";

const draftOf = (overrides: Partial<FormState>) =>
  formStateToDraftInput({ ...emptyState(), ...overrides });

describe("size on the form", () => {
  it("is stored when the species lets the player pick and the pick is allowed", () => {
    expect(draftOf({ speciesId: "human", size: "small" }).size).toBe("small");
    expect(draftOf({ speciesId: "tiefling", size: "medium" }).size).toBe("medium");
  });

  it("is left out when the species fixes it, whatever the state holds", () => {
    expect(draftOf({ speciesId: "halfling", size: "small" }).size).toBeUndefined();
    expect(draftOf({ speciesId: "dwarf", size: "medium" }).size).toBeUndefined();
  });

  it("is left out when nothing was picked, or the pick is not one of the species' sizes", () => {
    expect(draftOf({ speciesId: "human" }).size).toBeUndefined();
    expect(draftOf({ speciesId: "human", size: "large" }).size).toBeUndefined();
    expect(draftOf({}).size).toBeUndefined();
  });

  it("loads back from a stored draft, empty when absent", () => {
    expect(
      characterToState({ ...draftOf({ speciesId: "human", size: "small" }) } as never).size,
    ).toBe("small");
    expect(characterToState({ ...draftOf({ speciesId: "human" }) } as never).size).toBe("");
  });
});

describe("validateForm — class skills", () => {
  const fighter = {
    ...emptyState(),
    classId: "fighter" as const,
    backgroundId: "criminal",
    // Two class skills + three from the Doué origin feat, all in one field.
    skillProficiencies: ["athletics", "perception", "history", "arcana", "nature"],
  } as const;

  it("counts the class's own pick, not the skills a feat adds", () => {
    const errors = validateForm({
      ...fighter,
      skillProficiencies: [...fighter.skillProficiencies],
      choices: [
        { choiceId: "class:fighter:skills", values: ["athletics", "perception"] },
        {
          choiceId: "feat:skilled:proficiencies",
          values: ["skill:history", "skill:arcana", "skill:nature"],
        },
      ],
    });
    expect(errors.skills).toBeUndefined();
  });

  it("still asks for the missing class skills", () => {
    const errors = validateForm({
      ...fighter,
      skillProficiencies: [...fighter.skillProficiencies],
      choices: [{ choiceId: "class:fighter:skills", values: ["athletics"] }],
    });
    expect(errors.skills).toBe("Choisissez exactement 2 compétence(s) de classe.");
  });
});

describe("weapon masteries", () => {
  it("turn the items an older sheet named into kinds of weapon", () => {
    const weapons = [
      { id: "a", catalogId: "longsword" },
      { id: "b", catalogId: "longsword" },
      { id: "c" },
    ];
    expect(masteryKinds(weapons, ["a", "b", "c", "flail"])).toEqual(["longsword", "c", "flail"]);
  });
});

describe("the size picked in the species step", () => {
  it("is written to the sheet's size, not lost to the species' first one", () => {
    const state = withChoiceFields({
      ...emptyState(),
      speciesId: "human",
      choices: [{ choiceId: "species:human:size", values: ["medium"] }],
    });
    expect(state.size).toBe("medium");
    expect(formStateToDraftInput(state).size).toBe("medium");
  });
});
