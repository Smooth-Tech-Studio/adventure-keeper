import { describe, expect, it } from "vitest";
import { spellDamageSummary, type SpellDef } from "./spells";

type DamageSpell = Pick<SpellDef, "level" | "damage">;

const fireBolt: DamageSpell = {
  level: 0,
  damage: { pool: { count: 1, die: "d10" }, kind: "fire", scaling: "cantrip" },
};
const fireball: DamageSpell = {
  level: 3,
  damage: { pool: { count: 8, die: "d6" }, kind: "fire", scaling: "slot" },
};
const cureWounds: DamageSpell = {
  level: 1,
  damage: {
    pool: { count: 2, die: "d8" },
    kind: "heal",
    scaling: "slot",
    step: { count: 2, die: "d8" },
  },
};
const magicMissile: DamageSpell = {
  level: 1,
  damage: {
    pool: { count: 1, die: "d4" },
    kind: "force",
    scaling: "slot",
    note: "trois projectiles, +1 par niveau d'emplacement",
  },
};

describe("spellDamageSummary", () => {
  it("returns null when the spell rolls nothing", () => {
    expect(spellDamageSummary({ level: 2 }, {})).toBeNull();
  });

  it("cantrip: base dice + type, with the tier rule", () => {
    expect(spellDamageSummary(fireBolt, {})).toEqual({
      label: "Dégâts",
      dice: "1d10 feu",
      scaling: "+1d10 aux niveaux 5, 11 et 17",
      note: null,
    });
  });

  it("cantrip: totals the dice at the caster's level", () => {
    expect(spellDamageSummary(fireBolt, { characterLevel: 11 })?.dice).toBe("3d10 feu");
  });

  it("leveled spell: base dice + per-slot rule", () => {
    expect(spellDamageSummary(fireball, {})).toMatchObject({
      dice: "8d6 feu",
      scaling: "+1d6 par niveau d'emplacement au-delà du niveau 3",
    });
  });

  it("healing: `Soins` label, no damage type", () => {
    expect(spellDamageSummary(cureWounds, {})).toMatchObject({
      label: "Soins",
      dice: "2d8",
      scaling: "+2d8 par niveau d'emplacement au-delà du niveau 1",
    });
  });

  it("surfaces the free-text note", () => {
    expect(spellDamageSummary(magicMissile, {})?.note).toBe(
      "trois projectiles, +1 par niveau d'emplacement",
    );
  });
});
