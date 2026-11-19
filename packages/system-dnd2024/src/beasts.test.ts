import { describe, expect, it } from "vitest";
import {
  FAMILIAR_FORM_IDS,
  beastStats,
  challengeRatingValue,
  familiarForms,
  knownWildShapeForms,
  wildShapeForms,
  wildShapeRules,
} from "./beasts";
import { getMonster, monsterAttacks } from "./monsters";

describe("familiars", () => {
  it("offers every listed form, each a beast of CR 0 with its scores", () => {
    const ids = familiarForms().map((m) => m.id);
    for (const id of FAMILIAR_FORM_IDS) {
      expect(ids).toContain(id);
      expect(getMonster(id)?.cr).toBe("0");
      expect(beastStats(id)).toBeDefined();
    }
    expect(ids).not.toContain("wolf");
  });
});

describe("Wild Shape", () => {
  it("follows the druid's level: forms known, CR, flying", () => {
    expect(wildShapeRules(2)).toMatchObject({ formsKnown: 4, maxChallengeRating: 0.25 });
    expect(wildShapeRules(4)).toMatchObject({ formsKnown: 6, maxChallengeRating: 0.5 });
    expect(wildShapeRules(8)).toMatchObject({ formsKnown: 8, canFly: true });
    expect(challengeRatingValue("1/8")).toBe(0.125);
  });

  it("leaves out flying forms before level 8, and forms beyond the CR", () => {
    const at2 = wildShapeForms(2).map((m) => m.id);
    expect(at2).toContain("wolf");
    expect(at2).toContain("cat");
    expect(at2).not.toContain("owl");
    expect(at2).not.toContain("black-bear");
    expect(wildShapeForms(4).map((m) => m.id)).toContain("black-bear");
    const at8 = wildShapeForms(8).map((m) => m.id);
    expect(at8).toContain("owl");
    expect(at8).toContain("brown-bear");
    expect(at8).not.toContain("giant-scorpion");
  });

  it("keeps only the known forms still allowed, up to the count", () => {
    expect(knownWildShapeForms(["wolf", "owl", "nope"], 2).map((m) => m.id)).toEqual(["wolf"]);
    expect(knownWildShapeForms(["cat", "rat", "wolf", "boar", "frog"], 2)).toHaveLength(4);
  });

  it("gives every form an attack, the frog aside", () => {
    for (const monster of wildShapeForms(8)) {
      if (monster.id === "frog") continue;
      expect(monsterAttacks(monster.id).length, monster.id).toBeGreaterThan(0);
    }
  });
});
