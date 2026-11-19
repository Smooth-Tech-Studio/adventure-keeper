import { describe, expect, it } from "vitest";

import {
  ERROR_SECTION,
  FORM_ERROR_ORDER,
  FORM_SECTIONS,
  errorToast,
  orderedErrors,
  sectionHasError,
  sectionsInError,
} from "@/systems/dnd2024/character-form/errors";
import {
  emptyState,
  validateForm,
  withChoiceFields,
  type FormErrorKey,
  type FormState,
} from "@/systems/dnd2024/character-form/state";
import type { ChoicePick } from "@adventure-keeper/system-dnd2024";

/** A sheet that passes validation, as a base to break one thing at a time. */
function validState(): FormState {
  return {
    ...emptyState(),
    name: "Ysoril",
    speciesId: "human",
    classId: "fighter",
    backgroundId: "soldier",
    alignment: "N",
    // Human "Compétent" grants one skill of any kind.
    speciesSkillProficiencies: ["perception"],
    // Fighter picks 2 class skills.
    skillProficiencies: ["athletics", "intimidation"],
    // Soldier owes one gaming set; validation counts the picks, not their ids.
    toolProficiencies: ["dice-set"],
    base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    bonuses: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
  };
}

describe("validateForm", () => {
  it("passes on a complete sheet", () => {
    expect(validateForm(validState())).toEqual({});
  });

  it("reports every missing identity field on an empty sheet", () => {
    const errors = validateForm(emptyState());
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(["name", "speciesId", "classId", "backgroundId", "alignment", "base"]),
    );
  });

  // The bug this module exists for: a Bard picking the Soldier background owes
  // 3 instruments + 1 gaming set. Nothing else on the sheet is wrong, so
  // the only thing standing between the player and their character is a message
  // that used to be rendered nowhere at all.
  it("reports the tool proficiencies a Bard / Soldier still owes", () => {
    const errors = validateForm({
      ...validState(),
      classId: "bard",
      backgroundId: "soldier",
      skillProficiencies: ["acrobatics", "arcana", "athletics"], // Bard picks 3
    });
    expect(Object.keys(errors)).toEqual(["toolProficiencies"]);
    expect(errors.toolProficiencies).toContain("4");
  });

  // The wizard records picks and `withChoiceFields` rewrites the tool field
  // from them: tools from a feat land there too, and duplicates are merged.
  describe("tool picks recorded by the wizard", () => {
    const soldierPicks: ChoicePick[] = [
      { choiceId: "class:fighter:skills", values: ["athletics", "intimidation"] },
      { choiceId: "species:human:skill", values: ["perception"] },
      { choiceId: "background:soldier:tool", values: ["dice-set"] },
    ];

    it("ignores the tools an origin feat grants on top", () => {
      const errors = validateForm(
        withChoiceFields({
          ...validState(),
          choices: [
            ...soldierPicks,
            { choiceId: "species:human:origin-feat", values: ["skilled"] },
            {
              choiceId: "feat:skilled:proficiencies",
              values: ["skill:stealth", "tool:thieves-tools", "tool:lute"],
            },
          ],
        }),
      );
      expect(errors).toEqual({});
    });

    it("accepts the same tool picked by the class and the background", () => {
      const errors = validateForm(
        withChoiceFields({
          ...validState(),
          classId: "bard",
          backgroundId: "custom",
          skillProficiencies: ["acrobatics", "arcana", "athletics"],
          choices: [
            { choiceId: "class:bard:skills", values: ["acrobatics", "arcana", "athletics"] },
            { choiceId: "species:human:skill", values: ["perception"] },
            { choiceId: "class:bard:tool", values: ["lute", "bagpipes", "flute"] },
            { choiceId: "background:custom:tool", values: ["lute"] },
          ],
        }),
      );
      expect(errors).toEqual({});
    });

    it("still reports a background tool left unpicked", () => {
      const errors = validateForm(
        withChoiceFields({
          ...validState(),
          choices: [
            ...soldierPicks.filter((pick) => pick.choiceId !== "background:soldier:tool"),
            { choiceId: "species:human:origin-feat", values: ["skilled"] },
            {
              choiceId: "feat:skilled:proficiencies",
              values: ["skill:stealth", "tool:thieves-tools", "skill:arcana"],
            },
          ],
        }),
      );
      expect(Object.keys(errors)).toEqual(["toolProficiencies"]);
    });
  });

  it("reports weapon masteries beyond the class's slots", () => {
    const errors = validateForm({
      ...validState(),
      classId: "bard",
      skillProficiencies: ["acrobatics", "arcana", "athletics"],
      toolProficiencies: ["a", "b", "c", "d"], // Bard's 3 instruments + Soldier's gaming set
      weaponMasteries: ["some-weapon"], // Bard has no mastery slot
    });
    expect(Object.keys(errors)).toEqual(["weaponMasteries"]);
  });

  it("reports an unallocated background ability bonus", () => {
    const errors = validateForm({ ...validState(), bonuses: emptyState().bonuses });
    expect(Object.keys(errors)).toEqual(["bonuses"]);
  });

  it("reports the wrong number of class and species skills", () => {
    const errors = validateForm({
      ...validState(),
      speciesId: "elf",
      speciesChoice: "Drow",
      speciesSkillProficiencies: [],
      skillProficiencies: ["athletics"],
    });
    expect(Object.keys(errors).sort()).toEqual(["skills", "speciesSkills"]);
  });

  it("reports more eldritch invocations than the Warlock knows", () => {
    const errors = validateForm({
      ...validState(),
      classId: "warlock",
      skillProficiencies: ["arcana", "deception"],
      eldritchInvocations: [{ id: "agonizing-blast" }, { id: "devils-sight" }],
    });
    expect(Object.keys(errors)).toEqual(["invocations"]);
  });

  it("reports a missing species lineage", () => {
    const errors = validateForm({
      ...validState(),
      speciesId: "elf",
      speciesChoice: "",
      speciesSkillProficiencies: ["perception"],
    });
    expect(Object.keys(errors)).toEqual(["speciesChoice"]);
  });
});

/**
 * Every message `validateForm` can produce must have a section that shows it.
 * `ERROR_SECTION` is typed as total over `FormErrorKey`, which catches a *new*
 * key at compile time; these checks catch the rest — a key left out of the
 * display order, or a section whose card was renamed.
 */
describe("the error registry covers the validation", () => {
  const registered = Object.keys(ERROR_SECTION) as FormErrorKey[];

  it("orders exactly the registered keys, without duplicates", () => {
    expect([...FORM_ERROR_ORDER].sort()).toEqual([...registered].sort());
    expect(new Set(FORM_ERROR_ORDER).size).toBe(FORM_ERROR_ORDER.length);
  });

  it("points every key at a known section", () => {
    for (const key of registered) {
      expect(FORM_SECTIONS).toHaveProperty(ERROR_SECTION[key]);
    }
  });

  it("registers every key the validation actually emits", () => {
    // One state per scenario above, so the union is every reachable key.
    const scenarios: FormState[] = [
      emptyState(),
      { ...validState(), bonuses: emptyState().bonuses },
      { ...validState(), classId: "bard", backgroundId: "soldier" },
      { ...validState(), speciesId: "elf", speciesSkillProficiencies: [] },
      { ...validState(), weaponMasteries: ["a", "b", "c", "d", "e", "f"] },
      {
        ...validState(),
        classId: "warlock",
        skillProficiencies: ["arcana", "deception"], // Warlock picks 2 class skills
        eldritchInvocations: [{ id: "agonizing-blast" }, { id: "devils-sight" }],
      },
    ];
    const emitted = new Set(scenarios.flatMap((s) => Object.keys(validateForm(s))));
    expect(emitted.size).toBeGreaterThan(0);
    for (const key of emitted) expect(registered).toContain(key);
  });
});

describe("sectionsInError", () => {
  it("returns nothing when the sheet is valid", () => {
    expect(sectionsInError({})).toEqual([]);
  });

  it("returns each faulty card once, in page order", () => {
    const keys = sectionsInError({
      toolProficiencies: "Choisissez 4 maîtrise(s) d'outil.",
      name: "Nom requis.",
      alignment: "Choisissez un alignement.",
    });
    expect(keys).toEqual(["form-identity", "form-tools"]);
  });

  it("names the very cards the form mounts", () => {
    // Guards against a card being renamed on one side only — `reveal()` matches
    // on `storageKey`, so a typo would silently stop opening the section.
    expect(Object.values(FORM_SECTIONS).map((s) => s.storageKey)).toEqual([
      "form-identity",
      "form-abilities",
      "form-skills",
      "form-spells",
      "form-weapons",
      "form-tools",
    ]);
  });
});

describe("sectionHasError", () => {
  it("is true only for the section holding the error", () => {
    const errors = { toolProficiencies: "Choisissez 4 maîtrise(s) d'outil." };
    expect(sectionHasError(errors, "tools")).toBe(true);
    expect(sectionHasError(errors, "identity")).toBe(false);
  });
});

describe("orderedErrors", () => {
  it("returns the messages in page order, not insertion order", () => {
    const pairs = orderedErrors({ base: "Caractéristiques.", name: "Nom requis." });
    expect(pairs.map(([key]) => key)).toEqual(["name", "base"]);
  });
});

describe("errorToast", () => {
  it("names the section and quotes the problem", () => {
    const { title, lines } = errorToast({ toolProficiencies: "Choisissez 4 maîtrise(s) d'outil." });
    expect(title).toBe("1 point à corriger");
    expect(lines).toEqual(["Outils — Choisissez 4 maîtrise(s) d'outil."]);
  });

  it("counts the overflow instead of listing everything", () => {
    const { title, lines } = errorToast(validateForm(emptyState()));
    expect(title).toBe("6 points à corriger");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Identité — Nom requis.");
    expect(lines[3]).toBe("…et 3 autres.");
  });
});
