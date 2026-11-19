import { describe, expect, it } from "vitest";
import type { ClassId } from "@adventure-keeper/system-dnd2024";

import { emptyState, type FormState } from "@/systems/dnd2024/character-form/state";
import {
  buildLevelUpSubsteps,
  levelUpIssues,
  newChoiceDefs,
} from "@/systems/dnd2024/level-up/plan";

function at(classId: ClassId, level: number, extra: Partial<FormState> = {}): FormState {
  return {
    ...emptyState(),
    name: "Isolde",
    classId,
    speciesId: "elf",
    backgroundId: "sage",
    level,
    ...extra,
  };
}

const keys = (state: FormState, from: number) =>
  buildLevelUpSubsteps(state, from).map((sub) => sub.key);

describe("newChoiceDefs", () => {
  it("opens the subclass at level 3, and nothing already open before", () => {
    expect(newChoiceDefs(at("fighter", 3), 2).map((def) => def.id)).toEqual([
      "class:fighter:subclass",
    ]);
  });

  it("opens the level-4 feat, then the abilities once the improvement is taken", () => {
    expect(newChoiceDefs(at("wizard", 4), 3).map((def) => def.id)).toEqual(["level:4:feat"]);
    const picked = at("wizard", 4, {
      choices: [{ choiceId: "level:4:feat", values: ["ability-score-improvement"] }],
    });
    expect(newChoiceDefs(picked, 3).map((def) => def.id)).toEqual(["level:4:feat", "level:4:asi"]);
  });
});

describe("buildLevelUpSubsteps", () => {
  it("frames the screens with what is gained and the review", () => {
    const list = keys(at("barbarian", 2), 1);
    expect(list[0]).toBe("gains");
    expect(list.at(-1)).toBe("review");
  });

  it("puts the feat and its abilities on one screen", () => {
    expect(keys(at("wizard", 4), 3)).toEqual([
      "gains",
      "hit-points",
      "level:4:feat",
      "spells",
      "review",
    ]);
  });

  it("asks for Expertise when the rogue gets more of it", () => {
    expect(keys(at("rogue", 6, { skillExpertise: ["stealth", "perception"] }), 5)).toContain(
      "expertise",
    );
    expect(keys(at("rogue", 5, { skillExpertise: ["stealth", "perception"] }), 4)).not.toContain(
      "expertise",
    );
  });

  it("asks for one more Weapon Mastery when the count grows", () => {
    expect(keys(at("fighter", 4), 3)).toContain("masteries");
    expect(keys(at("fighter", 3), 2)).not.toContain("masteries");
  });
});

describe("levelUpIssues", () => {
  it("blocks the spells screen until both hands are full", () => {
    const state = at("wizard", 4, { cantrips: ["fire-bolt"], spells: [] });
    const spells = buildLevelUpSubsteps(state, 3).find((sub) => sub.kind === "spells")!;
    expect(levelUpIssues(spells, state, {})).toHaveLength(2);
  });
});

describe("Wild Shape forms", () => {
  const wildShape = (state: FormState) =>
    buildLevelUpSubsteps(state, state.level - 1).find((sub) => sub.kind === "wildShape");

  it("asks for the forms when Wild Shape opens, and when it grows", () => {
    expect(keys(at("druid", 2), 1)).toContain("wildShape");
    expect(keys(at("druid", 4), 3)).toContain("wildShape");
    expect(keys(at("druid", 8), 7)).toContain("wildShape");
    expect(keys(at("wizard", 2), 1)).not.toContain("wildShape");
  });

  it("skips a level that changes nothing, once the forms are all known", () => {
    const known = ["wolf", "cat", "boar", "mastiff"];
    expect(keys(at("druid", 3, { wildShapeForms: known }), 2)).not.toContain("wildShape");
    // Short of forms: the screen comes back to fill them.
    expect(keys(at("druid", 3, { wildShapeForms: ["wolf"] }), 2)).toContain("wildShape");
  });

  it("wants as many forms as the level allows", () => {
    const short = at("druid", 2, { wildShapeForms: ["wolf", "cat"] });
    expect(levelUpIssues(wildShape(short)!, short, {})).toHaveLength(1);
    const full = at("druid", 2, { wildShapeForms: ["wolf", "cat", "boar", "mastiff"] });
    expect(levelUpIssues(wildShape(full)!, full, {})).toEqual([]);
  });
});
