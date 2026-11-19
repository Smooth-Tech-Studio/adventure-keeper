import { describe, expect, it } from "vitest";
import { ABILITIES, SPELL_SAVE_OUTCOMES, spellSaveSchema, type SpellDef } from "../index";

import spellsFile from "./spells.json";
import resolutionRef from "../../../../scripts/data/spell-resolution-2024.json";

const spells = spellsFile.entries;

const SPELLS = spells as SpellDef[];

/**
 * Deliberate deviations from the aidedd reference — must mirror `OVERRIDES` in
 * `scripts/annotate-spell-resolution.ts` (resolution-affecting entries only).
 */
const RESOLUTION_OVERRIDES: Record<string, Pick<SpellDef, "save" | "attackRoll">> = {
  "true-strike": { attackRoll: true },
  "heat-metal": { save: { ability: "con", onSuccess: "partial" } },
  "dragons-breath": { save: { ability: "dex", onSuccess: "partial" } },
  "glyph-of-warding": { save: { ability: "dex", onSuccess: "partial" } },
};

type RefEntry = { save?: SpellDef["save"]; attackRoll?: true };
const REF = resolutionRef as Record<string, RefEntry>;

describe("spells.json — resolution data", () => {
  it("every `save` block is well-formed", () => {
    for (const spell of SPELLS) {
      if (!spell.save) continue;
      expect(() => spellSaveSchema.parse(spell.save), spell.id).not.toThrow();
      expect(ABILITIES, spell.id).toContain(spell.save.ability);
      expect(SPELL_SAVE_OUTCOMES, spell.id).toContain(spell.save.onSuccess);
    }
  });

  it("`attackRoll` is only ever the literal `true`", () => {
    for (const spell of SPELLS) {
      if (spell.attackRoll === undefined) continue;
      expect(spell.attackRoll, spell.id).toBe(true);
    }
  });

  it("a `half`-on-success save implies the spell rolls damage", () => {
    for (const spell of SPELLS) {
      if (spell.save?.onSuccess !== "half") continue;
      expect(spell.damage, `${spell.id} — "half" save but no damage`).toBeDefined();
    }
  });

  it("almost every damaging spell says how it is rolled / resisted", () => {
    const damaging = SPELLS.filter((s) => s.damage && s.damage.kind !== "heal");
    const bare = damaging.filter((s) => !s.save && !s.attackRoll).map((s) => s.id);
    // Magic Missile auto-hits — it is the only damaging spell with no roll.
    expect(bare).toEqual(["magic-missile"]);
  });

  it("save / attackRoll match the committed aidedd 2024 reference", () => {
    for (const spell of SPELLS) {
      const ov = RESOLUTION_OVERRIDES[spell.id];
      const ref: RefEntry = REF[spell.id] ?? {};
      const wantSave = ov ? (ov.save ?? null) : (ref.save ?? null);
      const wantAttack = ov ? Boolean(ov.attackRoll) : Boolean(ref.attackRoll);
      expect(spell.save ?? null, `${spell.id} save`).toEqual(wantSave);
      expect(Boolean(spell.attackRoll), `${spell.id} attackRoll`).toBe(wantAttack);
    }
  });

  it("the reference only lists spells we actually ship", () => {
    const ids = new Set(SPELLS.map((s) => s.id));
    for (const id of Object.keys(REF)) expect(ids, id).toContain(id);
  });
});
