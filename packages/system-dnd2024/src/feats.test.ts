import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import {
  FEATS,
  featChoices,
  featBonusActions,
  featCombatNotes,
  featEffects,
  featsAvailableAt,
  featsOfCategory,
  getFeat,
  hasFightingStyle,
} from "./feats";
import { withContent } from "./packs/active";
import { EFFECTS, essai } from "./packs/fixtures/effects-pack";

describe("feat catalogue", () => {
  it("has unique ids", () => {
    const ids = FEATS.map((feat) => feat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has the 4 SRD origin feats, as 6 entries", () => {
    // « Initié à la magie » is one repeatable feat in the rules, but a background
    // grants it for a *specific* spell list — so it is stored as one entry per
    // list, which lets `originFeatId` be a direct reference.
    const origin = featsOfCategory("origin");
    expect(origin).toHaveLength(6);
    expect(origin.filter((feat) => feat.id.startsWith("magic-initiate-"))).toHaveLength(3);
    expect(origin.filter((feat) => !feat.id.startsWith("magic-initiate-"))).toHaveLength(3);
  });

  it("has the 4 SRD fighting styles", () => {
    expect(featsOfCategory("fightingStyle")).toHaveLength(4);
  });

  it("gives every feat a non-empty summary in French", () => {
    for (const feat of FEATS) {
      expect(feat.summary.length).toBeGreaterThan(20);
      expect(feat.name.length).toBeGreaterThan(0);
    }
  });

  it("gives every inner choice an id namespaced on its feat", () => {
    for (const feat of FEATS) {
      for (const choice of feat.choices ?? []) {
        expect(choice.id.startsWith(`feat:${feat.id}:`)).toBe(true);
        expect(choice.source).toBe("feat");
      }
    }
  });
});

describe("getFeat", () => {
  it("finds a feat and returns undefined otherwise", () => {
    expect(getFeat("alert")?.name).toBe("Vigilant");
    expect(getFeat("nope")).toBeUndefined();
  });
});

describe("featChoices", () => {
  it("returns the picks a feat opens", () => {
    expect(featChoices(["skilled"]).map((choice) => choice.id)).toEqual([
      "feat:skilled:proficiencies",
    ]);
    // 2 cantrips + 1 spell + the casting ability.
    expect(featChoices(["magic-initiate-druid"])).toHaveLength(3);
  });

  it("returns nothing for a feat with no inner choice, and ignores unknown ids", () => {
    expect(featChoices(["alert", "nope"])).toEqual([]);
  });

  it("merges the choices of several feats", () => {
    withContent(EFFECTS, () => {
      expect(featChoices(["skilled", essai("musicien")]).map((choice) => choice.id)).toEqual([
        "feat:skilled:proficiencies",
        "feat:essai:musicien:instruments",
      ]);
    });
  });
});

describe("featEffects", () => {
  it("is all zeroes with no feat", () => {
    expect(featEffects([])).toEqual({
      hitPointsPerLevel: 0,
      rangedAttackBonus: 0,
      duelingDamageBonus: 0,
      thrownDamageBonus: 0,
      armoredAcBonus: 0,
      armorTraining: [],
      unarmedDamageDice: null,
      heavyWeaponProficiencyDamage: false,
    });
  });

  it("reads Archerie and Défense", () => {
    expect(featEffects(["archery"]).rangedAttackBonus).toBe(2);
    expect(featEffects(["defense"]).armoredAcBonus).toBe(1);
  });

  // The SRD feats carry only these two; the others come through a pack.
  it("reads hit points, Duel and thrown-weapon bonuses from a pack feat", () => {
    withContent(EFFECTS, () => {
      expect(featEffects([essai("robuste")]).hitPointsPerLevel).toBe(2);
      expect(featEffects([essai("duel")]).duelingDamageBonus).toBe(2);
      expect(featEffects([essai("lancer")]).thrownDamageBonus).toBe(2);
    });
  });

  it("reads the Unarmed Strike die and the Heavy-weapon damage", () => {
    withContent(EFFECTS, () => {
      expect(featEffects([essai("bagarreur")]).unarmedDamageDice).toEqual({ count: 1, die: "d4" });
      expect(featEffects([essai("armes-lourdes")]).heavyWeaponProficiencyDamage).toBe(true);
      expect(featEffects([essai("robuste")]).heavyWeaponProficiencyDamage).toBe(false);
    });
  });

  it("sums across feats and ignores unknown ids", () => {
    withContent(EFFECTS, () => {
      const effects = featEffects([essai("robuste"), "archery", "nope"]);
      expect(effects.hitPointsPerLevel).toBe(2);
      expect(effects.rangedAttackBonus).toBe(2);
    });
  });
});

describe("hasFightingStyle", () => {
  it("opens at Fighter 1, Paladin 2 and Ranger 2", () => {
    expect(hasFightingStyle("fighter", 1)).toBe(true);
    expect(hasFightingStyle("paladin", 1)).toBe(false);
    expect(hasFightingStyle("paladin", 2)).toBe(true);
    expect(hasFightingStyle("ranger", 2)).toBe(true);
  });

  it("is false for every other class", () => {
    expect(hasFightingStyle("wizard", 20)).toBe(false);
    expect(hasFightingStyle("barbarian", 20)).toBe(false);
  });
});

describe("featBonusActions", () => {
  it("lists only the feats that unlock one", () => {
    withContent(EFFECTS, () => {
      expect(featBonusActions([])).toEqual([]);
      expect(featBonusActions(["alert", essai("robuste")])).toEqual([]);
      expect(featBonusActions([essai("hast")])).toHaveLength(1);
      expect(featBonusActions([essai("hast"), essai("armes-lourdes")])).toHaveLength(2);
    });
  });
});

describe("featCombatNotes", () => {
  it("returns a reminder only for the feats that need one", () => {
    expect(featCombatNotes([])).toEqual([]);
    expect(featCombatNotes(["skilled"])).toEqual([]);
    expect(featCombatNotes(["savage-attacker"])).toHaveLength(1);
    expect(featCombatNotes(["savage-attacker", "great-weapon-fighting"])).toHaveLength(2);
  });

  it("reads every feat's note, SRD or pack alike, in the order of the feats", () => {
    withContent(EFFECTS, () => {
      expect(featCombatNotes([essai("duel"), "savage-attacker"])).toEqual([
        "Duel d'essai : +2 aux dégâts à une main (déjà appliqué).",
        "Sauvagerie martiale : une fois par tour, lancez deux fois les dés de dégâts d'une attaque avec une arme et retenez le total de votre choix.",
      ]);
    });
  });
});

describe("backgrounds reference real feats", () => {
  // The custom background grants nothing: its origin feat is a pick, so it is
  // the one entry with no `originFeatId`.
  const granted = BACKGROUNDS.filter((background) => background.originFeatId !== undefined);

  it("leaves exactly one background without a granted feat — the custom one", () => {
    expect(BACKGROUNDS.length - granted.length).toBe(1);
    expect(BACKGROUNDS.find((background) => !background.originFeatId)?.id).toBe("custom");
  });

  it("resolves every granted originFeatId", () => {
    const unresolved = granted
      .filter((background) => !getFeat(background.originFeatId!))
      .map((background) => `${background.id} → ${background.originFeatId}`);
    expect(unresolved).toEqual([]);
  });

  it("points them all at origin feats, never at a style or a general feat", () => {
    for (const background of granted) {
      expect(getFeat(background.originFeatId!)?.category, background.id).toBe("origin");
    }
  });

  it("gives each of the 4 SRD backgrounds a different origin feat", () => {
    const used = new Set(granted.map((background) => background.originFeatId));
    expect(used).toEqual(
      new Set(["magic-initiate-cleric", "alert", "magic-initiate-wizard", "savage-attacker"]),
    );
  });
});

describe("general feats and epic boons", () => {
  it("has the 2 SRD general feats and the 7 epic boons", () => {
    expect(featsOfCategory("general").map((feat) => feat.id)).toEqual([
      "ability-score-improvement",
      "grappler",
    ]);
    expect(featsOfCategory("epic")).toHaveLength(7);
    expect(FEATS).toHaveLength(6 + 4 + 2 + 7);
  });

  it("gates general feats at level 4 and epic boons at 19", () => {
    for (const feat of featsOfCategory("general")) expect(feat.minLevel, feat.id).toBe(4);
    for (const feat of featsOfCategory("epic")) expect(feat.minLevel, feat.id).toBe(19);
  });

  it("leaves origin feats and fighting styles ungated by level", () => {
    for (const feat of [...featsOfCategory("origin"), ...featsOfCategory("fightingStyle")]) {
      expect(feat.minLevel, feat.id).toBeUndefined();
    }
  });

  it("treats « Amélioration de caractéristique » as a repeatable general feat", () => {
    const asi = getFeat("ability-score-improvement");
    expect(asi).toMatchObject({ category: "general", minLevel: 4, repeatable: true });
  });

  it("featsAvailableAt filters on the character's level", () => {
    expect(featsAvailableAt("general", 3)).toHaveLength(0);
    expect(featsAvailableAt("general", 4)).toHaveLength(2);
    expect(featsAvailableAt("epic", 18)).toHaveLength(0);
    expect(featsAvailableAt("epic", 19)).toHaveLength(7);
    expect(featsAvailableAt("origin", 1)).toHaveLength(6);
  });
});
