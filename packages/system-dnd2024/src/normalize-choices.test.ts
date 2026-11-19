import { describe, expect, it } from "vitest";
import { computeCharacterDerived } from "./character-rules";
import { choiceDerivedInput, normalizeChoices } from "./normalize-choices";
import { resolveChoices } from "./resolve-choices";
import type { AbilityBonusBlock, AbilityScoreBlock } from "./abilities";
import type { ChoicePick } from "./choices";

const NO_BONUS: AbilityBonusBlock = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const SCORES: AbilityScoreBlock = { str: 10, dex: 14, con: 14, int: 10, wis: 15, cha: 12 };

/** A level-1 druid elf hermit, the walkthrough character. */
const SHEET = { classId: "druid", speciesId: "elf", backgroundId: "criminal", level: 1 };
const defsFor = (picks?: ChoicePick[]) => resolveChoices({ ...SHEET, picks });

describe("choiceDerivedInput", () => {
  it("is empty without picks", () => {
    expect(choiceDerivedInput(defsFor(), [])).toEqual({
      skillProficiencies: [],
      speciesSkillProficiencies: [],
      toolProficiencies: [],
    });
  });

  it("routes class skills and species skills to their own bucket", () => {
    const picks: ChoicePick[] = [
      { choiceId: "class:druid:skills", values: ["nature", "survival"] },
      { choiceId: "species:elf:skill", values: ["perception"] },
    ];
    const out = choiceDerivedInput(defsFor(picks), picks);
    expect(out.skillProficiencies).toEqual(["nature", "survival"]);
    expect(out.speciesSkillProficiencies).toEqual(["perception"]);
  });

  it("reads the lineage back as speciesChoice", () => {
    const picks: ChoicePick[] = [{ choiceId: "species:elf:lineage", values: ["Drow"] }];
    expect(choiceDerivedInput(defsFor(picks), picks).speciesChoice).toBe("Drow");
  });

  it("splits Doué's mixed proficiencies into skills and tools", () => {
    const picks: ChoicePick[] = [
      { choiceId: "background:custom:origin-feat", values: ["skilled"] },
      {
        choiceId: "feat:skilled:proficiencies",
        values: ["skill:history", "tool:lute", "skill:arcana"],
      },
    ];
    const defs = resolveChoices({ classId: "druid", backgroundId: "custom", level: 1, picks });
    const out = choiceDerivedInput(defs, picks);
    expect(out.skillProficiencies).toEqual(["history", "arcana"]);
    expect(out.toolProficiencies).toEqual(["lute"]);
  });

  it("ignores a pick whose choice is no longer open", () => {
    // A bard skill kept after switching to druid.
    const picks: ChoicePick[] = [{ choiceId: "class:bard:skills", values: ["performance"] }];
    expect(choiceDerivedInput(defsFor(picks), picks).skillProficiencies).toEqual([]);
  });
});

describe("computeCharacterDerived with choices", () => {
  const base = {
    classId: "druid",
    level: 1,
    baseAbilityScores: SCORES,
    backgroundAbilityBonuses: NO_BONUS,
    backgroundId: "criminal",
    speciesId: "elf",
  };

  it("derives the same block whether skills come from choices or the old field", () => {
    const legacy = computeCharacterDerived({
      ...base,
      skillProficiencies: ["nature", "survival"],
      speciesSkillProficiencies: ["perception"],
    });
    const viaChoices = computeCharacterDerived({
      ...base,
      choices: [
        { choiceId: "class:druid:skills", values: ["nature", "survival"] },
        { choiceId: "species:elf:skill", values: ["perception"] },
      ],
    });
    expect(viaChoices.proficientSkills).toEqual(legacy.proficientSkills);
    expect(viaChoices.skillModifiers).toEqual(legacy.skillModifiers);
    expect(viaChoices.passivePerception).toBe(legacy.passivePerception);
  });

  it("leaves a sheet without choices exactly as it was — no regression", () => {
    const before = computeCharacterDerived({ ...base, skillProficiencies: ["nature"] });
    const after = computeCharacterDerived({ ...base, skillProficiencies: ["nature"], choices: [] });
    expect(after).toEqual(before);
  });

  it("applies a lineage picked as a choice", () => {
    const d = computeCharacterDerived({
      ...base,
      choices: [{ choiceId: "species:elf:lineage", values: ["Drow"] }],
    });
    // The Drow lineage pushes darkvision past the elf's base 60 ft.
    expect(d.darkvision).toBeGreaterThan(60);
  });
});

describe("normalizeChoices", () => {
  it("reads an old sheet's dedicated fields back as picks", () => {
    const defs = defsFor();
    const picks = normalizeChoices(defs, {
      skillProficiencies: ["nature", "survival"],
      speciesSkillProficiencies: ["perception"],
      speciesChoice: "Drow",
    });
    expect(picks).toContainEqual({
      choiceId: "class:druid:skills",
      values: ["nature", "survival"],
    });
    expect(picks).toContainEqual({ choiceId: "species:elf:skill", values: ["perception"] });
    expect(picks).toContainEqual({ choiceId: "species:elf:lineage", values: ["Drow"] });
  });

  it("drops a stored value the choice no longer allows", () => {
    const picks = normalizeChoices(defsFor(), { skillProficiencies: ["nature", "performance"] });
    const skills = picks.find((pick) => pick.choiceId === "class:druid:skills");
    expect(skills?.values).toEqual(["nature"]);
  });

  it("keeps an existing pick over the legacy field", () => {
    const picks = normalizeChoices(defsFor(), {
      skillProficiencies: ["nature", "survival"],
      choices: [{ choiceId: "class:druid:skills", values: ["medicine"] }],
    });
    expect(picks.find((pick) => pick.choiceId === "class:druid:skills")?.values).toEqual([
      "medicine",
    ]);
  });

  it("round-trips: normalize then derive gives the legacy fields back", () => {
    const sheet = {
      skillProficiencies: ["nature", "survival"],
      speciesSkillProficiencies: ["perception"],
    };
    const picks = normalizeChoices(defsFor(), sheet);
    const out = choiceDerivedInput(defsFor(picks), picks);
    expect(out.skillProficiencies).toEqual(sheet.skillProficiencies);
    expect(out.speciesSkillProficiencies).toEqual(sheet.speciesSkillProficiencies);
  });
});
