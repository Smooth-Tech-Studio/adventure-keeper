import { describe, expect, it } from "vitest";
import {
  choicePoolValues,
  choiceValue,
  choiceValues,
  isChoiceOpen,
  parseProficiencyValue,
  pickedValuesOfKind,
  proficiencyValue,
  proficiencyValuesOfKind,
  pruneChoicePicks,
  validateChoices,
  type ChoiceDef,
  type ChoicePick,
} from "./choices";

const CLASS_SKILLS: ChoiceDef = {
  id: "class:druid:skills",
  source: "class",
  kind: "skill",
  label: "Compétences de druide",
  count: 2,
  pool: { kind: "list", values: ["nature", "perception", "survival", "medicine"] },
};

const ANY_SKILL: ChoiceDef = {
  id: "species:human:skill",
  source: "species",
  kind: "skill",
  label: "Compétent",
  count: 1,
  pool: { kind: "any" },
};

const EXPERTISE: ChoiceDef = {
  id: "class:rogue:expertise",
  source: "class",
  kind: "skill",
  label: "Expertise",
  count: 2,
  pool: { kind: "proficient" },
};

const ASI: ChoiceDef = {
  id: "level:4:asi",
  source: "level",
  kind: "ability",
  label: "Amélioration de caractéristique",
  count: 1,
  pool: { kind: "any" },
  minLevel: 4,
};

const PACT_SPELL: ChoiceDef = {
  id: "feat:magic-initiate:spell",
  source: "feat",
  kind: "spell",
  label: "Sort de niveau 1",
  count: 1,
  pool: { kind: "any" },
};

describe("choiceValues / choiceValue", () => {
  it("reads the picked values, empty when untouched", () => {
    const picks: ChoicePick[] = [
      { choiceId: "class:druid:skills", values: ["nature", "survival"] },
    ];
    expect(choiceValues(picks, "class:druid:skills")).toEqual(["nature", "survival"]);
    expect(choiceValues(picks, "unknown")).toEqual([]);
    expect(choiceValues(undefined, "class:druid:skills")).toEqual([]);
  });

  it("choiceValue returns the first value", () => {
    const picks: ChoicePick[] = [{ choiceId: "species:human:skill", values: ["stealth"] }];
    expect(choiceValue(picks, "species:human:skill")).toBe("stealth");
    expect(choiceValue(picks, "unknown")).toBeUndefined();
  });
});

describe("pickedValuesOfKind", () => {
  it("merges every pick of that kind across sources, de-duplicated", () => {
    const picks: ChoicePick[] = [
      { choiceId: "class:druid:skills", values: ["nature", "survival"] },
      { choiceId: "species:human:skill", values: ["nature"] },
      { choiceId: "level:4:asi", values: ["con"] },
    ];
    expect(pickedValuesOfKind([CLASS_SKILLS, ANY_SKILL, ASI], picks, "skill").sort()).toEqual([
      "nature",
      "survival",
    ]);
    expect(pickedValuesOfKind([CLASS_SKILLS, ANY_SKILL, ASI], picks, "ability")).toEqual(["con"]);
  });
});

describe("choicePoolValues", () => {
  it("returns the explicit list as-is", () => {
    expect(choicePoolValues(CLASS_SKILLS)).toEqual([
      "nature",
      "perception",
      "survival",
      "medicine",
    ]);
  });

  it("enumerates the 18 skills for an `any` pool over a built-in kind", () => {
    expect(choicePoolValues(ANY_SKILL)).toHaveLength(18);
    expect(choicePoolValues(ASI)).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });

  it("reads `proficient` from the context", () => {
    expect(choicePoolValues(EXPERTISE, { proficient: { skill: ["stealth", "arcana"] } })).toEqual([
      "stealth",
      "arcana",
    ]);
    expect(choicePoolValues(EXPERTISE)).toEqual([]);
  });

  it("falls back to the supplied catalogue for a kind it cannot enumerate", () => {
    expect(choicePoolValues(PACT_SPELL)).toEqual([]);
    expect(choicePoolValues(PACT_SPELL, { catalog: { spell: ["bless", "guidance"] } })).toEqual([
      "bless",
      "guidance",
    ]);
  });
});

describe("mixed skill-or-tool values", () => {
  const SKILLED: ChoiceDef = {
    id: "feat:skilled:proficiencies",
    source: "feat",
    kind: "proficiency",
    label: "Doué",
    count: 3,
    pool: { kind: "any" },
  };

  it("round-trips a namespaced value", () => {
    expect(proficiencyValue("skill", "stealth")).toBe("skill:stealth");
    expect(parseProficiencyValue("skill:stealth")).toEqual({ kind: "skill", id: "stealth" });
    expect(parseProficiencyValue("tool:thieves-tools")).toEqual({
      kind: "tool",
      id: "thieves-tools",
    });
  });

  it("rejects malformed values", () => {
    expect(parseProficiencyValue("stealth")).toBeNull();
    expect(parseProficiencyValue(":stealth")).toBeNull();
    expect(parseProficiencyValue("skill:")).toBeNull();
    expect(parseProficiencyValue("weapon:longsword")).toBeNull();
  });

  it("splits a pick back into skills and tools", () => {
    const values = ["skill:stealth", "tool:thieves-tools", "skill:arcana", "bogus"];
    expect(proficiencyValuesOfKind(values, "skill")).toEqual(["stealth", "arcana"]);
    expect(proficiencyValuesOfKind(values, "tool")).toEqual(["thieves-tools"]);
  });

  it("builds an `any` pool from the 18 skills plus the tool catalogue", () => {
    expect(choicePoolValues(SKILLED)).toHaveLength(18);
    const withTools = choicePoolValues(SKILLED, { catalog: { tool: ["thieves-tools", "lute"] } });
    expect(withTools).toHaveLength(20);
    expect(withTools).toContain("skill:stealth");
    expect(withTools).toContain("tool:lute");
  });

  it("validates a mixed pick against that pool", () => {
    const context = { catalog: { tool: ["thieves-tools"] } };
    const ok = validateChoices(
      [SKILLED],
      [{ choiceId: SKILLED.id, values: ["skill:stealth", "skill:arcana", "tool:thieves-tools"] }],
      1,
      context,
    );
    expect(ok).toEqual([]);

    const stray = validateChoices(
      [SKILLED],
      [{ choiceId: SKILLED.id, values: ["skill:stealth", "skill:arcana", "tool:lute"] }],
      1,
      context,
    );
    expect(stray.map((e) => e.code)).toContain("outOfPool");
  });
});

describe("isChoiceOpen", () => {
  it("honours minLevel", () => {
    expect(isChoiceOpen(ASI, 3, [])).toBe(false);
    expect(isChoiceOpen(ASI, 4, [])).toBe(true);
    expect(isChoiceOpen(CLASS_SKILLS, 1, [])).toBe(true);
  });

  it("honours a `requires` gate", () => {
    const gated: ChoiceDef = {
      ...PACT_SPELL,
      id: "feat:gated",
      requires: { choiceId: "class:warlock:pact", value: "blade" },
    };
    expect(isChoiceOpen(gated, 1, [])).toBe(false);
    expect(isChoiceOpen(gated, 1, [{ choiceId: "class:warlock:pact", values: ["chain"] }])).toBe(
      false,
    );
    expect(isChoiceOpen(gated, 1, [{ choiceId: "class:warlock:pact", values: ["blade"] }])).toBe(
      true,
    );
  });
});

describe("validateChoices", () => {
  const defs = [CLASS_SKILLS, ASI];

  it("reports a choice left incomplete", () => {
    const errors = validateChoices(defs, [{ choiceId: CLASS_SKILLS.id, values: ["nature"] }], 1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ choiceId: CLASS_SKILLS.id, code: "missing" });
    expect(errors[0].message).toContain("1 sur 2");
  });

  it("reports too many, duplicates and values outside the pool", () => {
    const tooMany = validateChoices(
      defs,
      [{ choiceId: CLASS_SKILLS.id, values: ["nature", "survival", "medicine"] }],
      1,
    );
    expect(tooMany.map((e) => e.code)).toContain("tooMany");

    const dup = validateChoices(
      defs,
      [{ choiceId: CLASS_SKILLS.id, values: ["nature", "nature"] }],
      1,
    );
    expect(dup.map((e) => e.code)).toContain("duplicate");

    const stray = validateChoices(
      defs,
      [{ choiceId: CLASS_SKILLS.id, values: ["nature", "stealth"] }],
      1,
    );
    expect(stray.map((e) => e.code)).toContain("outOfPool");
  });

  it("ignores choices that are not open yet", () => {
    const errors = validateChoices(
      defs,
      [{ choiceId: CLASS_SKILLS.id, values: ["nature", "survival"] }],
      1,
    );
    expect(errors).toEqual([]);
  });

  it("requires the level choice once the level is reached", () => {
    const errors = validateChoices(
      defs,
      [{ choiceId: CLASS_SKILLS.id, values: ["nature", "survival"] }],
      4,
    );
    expect(errors.map((e) => e.choiceId)).toEqual([ASI.id]);
  });

  it("skips membership when the pool cannot be enumerated", () => {
    expect(
      validateChoices([PACT_SPELL], [{ choiceId: PACT_SPELL.id, values: ["bless"] }], 1),
    ).toEqual([]);
  });
});

describe("pruneChoicePicks", () => {
  it("keeps the tools of a mixed pick (Doué) when the tool catalogue is not loaded", () => {
    const skilled: ChoiceDef = {
      id: "feat:skilled:proficiencies",
      source: "feat",
      kind: "proficiency",
      label: "Maîtrises",
      count: 3,
      pool: { kind: "any" },
    };
    const picks: ChoicePick[] = [
      { choiceId: skilled.id, values: ["skill:stealth", "tool:lute", "skill:nowhere"] },
    ];
    expect(pruneChoicePicks([skilled], picks, 1)).toEqual([
      { choiceId: skilled.id, values: ["skill:stealth", "tool:lute"] },
    ]);
    expect(pruneChoicePicks([skilled], picks, 1, { catalog: { tool: ["flute"] } })).toEqual([
      { choiceId: skilled.id, values: ["skill:stealth"] },
    ]);
  });

  it("drops picks whose choice disappeared", () => {
    const picks: ChoicePick[] = [
      { choiceId: CLASS_SKILLS.id, values: ["nature", "survival"] },
      { choiceId: "class:bard:skills", values: ["performance"] },
    ];
    expect(pruneChoicePicks([CLASS_SKILLS], picks, 1)).toEqual([
      { choiceId: CLASS_SKILLS.id, values: ["nature", "survival"] },
    ]);
  });

  it("drops values that left the pool and trims to count", () => {
    const picks: ChoicePick[] = [
      { choiceId: CLASS_SKILLS.id, values: ["nature", "stealth", "survival", "medicine"] },
    ];
    expect(pruneChoicePicks([CLASS_SKILLS], picks, 1)).toEqual([
      { choiceId: CLASS_SKILLS.id, values: ["nature", "survival"] },
    ]);
  });

  it("drops a pick whose choice is no longer open", () => {
    const picks: ChoicePick[] = [{ choiceId: ASI.id, values: ["con"] }];
    expect(pruneChoicePicks([ASI], picks, 3)).toEqual([]);
    expect(pruneChoicePicks([ASI], picks, 4)).toEqual(picks);
  });

  it("de-duplicates", () => {
    const picks: ChoicePick[] = [{ choiceId: CLASS_SKILLS.id, values: ["nature", "nature"] }];
    expect(pruneChoicePicks([CLASS_SKILLS], picks, 1)).toEqual([
      { choiceId: CLASS_SKILLS.id, values: ["nature"] },
    ]);
  });
});
