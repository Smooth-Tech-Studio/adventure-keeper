import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  SKILLS,
  SKILL_SUMMARY,
  type ArmorDef,
  type ChoiceDef,
  type EquipmentPackDef,
  type GearDef,
  type SpellDef,
  type ToolDef,
} from "@adventure-keeper/system-dnd2024";
import { choiceValueSummary } from "./choices";
import armorsFile from "../../../../../../packages/system-dnd2024/src/srd/armors.json";
import packsFile from "../../../../../../packages/system-dnd2024/src/srd/equipment-packs.json";
import gearFile from "../../../../../../packages/system-dnd2024/src/srd/gear.json";
import spellsFile from "../../../../../../packages/system-dnd2024/src/srd/spells.json";
import toolsFile from "../../../../../../packages/system-dnd2024/src/srd/tools.json";

const [armors, packs, gear, spells, tools] = [
  armorsFile,
  packsFile,
  gearFile,
  spellsFile,
  toolsFile,
].map((file) => file.entries);

const catalogs = {
  tools: tools as unknown as ToolDef[],
  gear: gear as unknown as GearDef[],
  spells: spells as unknown as SpellDef[],
  weapons: [],
  armors: [],
  packs: packs as unknown as EquipmentPackDef[],
};

const defOf = (kind: ChoiceDef["kind"]): ChoiceDef => ({
  id: `test:${kind}`,
  source: "class",
  kind,
  label: kind,
  count: 1,
  pool: { kind: "any" },
});

/**
 * A picker that lists a name and a school asks the player to choose blind. The
 * catalogues have carried the explanation all along — these tests are what
 * stops it being dropped again.
 */
describe("résumés dans les sélecteurs", () => {
  it("explique un sort", () => {
    const summary = choiceValueSummary(defOf("spell"), "acid-splash", catalogs);
    expect(summary).toBeTruthy();
    expect(summary!.length).toBeGreaterThan(20);
  });

  it("explique un outil", () => {
    expect(choiceValueSummary(defOf("tool"), "alchemist-supplies", catalogs)).toContain(
      "alchimiques",
    );
  });

  it("explique un objet du matériel d'aventurier", () => {
    expect(choiceValueSummary(defOf("item"), "crowbar", catalogs)).toBeTruthy();
  });

  it("explique les dix-huit compétences", () => {
    for (const skill of SKILLS) {
      const summary = choiceValueSummary(defOf("skill"), skill, catalogs);
      expect(summary, skill).toBe(SKILL_SUMMARY[skill]);
      expect(summary!.length, skill).toBeGreaterThan(30);
    }
  });

  it("explique une maîtrise mixte, compétence comme outil", () => {
    expect(choiceValueSummary(defOf("proficiency"), "skill:stealth", catalogs)).toBe(
      SKILL_SUMMARY.stealth,
    );
    expect(choiceValueSummary(defOf("proficiency"), "tool:alchemist-supplies", catalogs)).toContain(
      "alchimiques",
    );
  });

  it("explique les dix-neuf langues", () => {
    for (const language of LANGUAGES) {
      expect(choiceValueSummary(defOf("language"), language.id, catalogs), language.name).toBe(
        language.summary,
      );
    }
  });

  it("explique une armure par ce qu'elle est", () => {
    // The picker goes through `armorOptions`, but a « Broigne » must read as
    // something before the player picks it.
    const armor = (armors as unknown as ArmorDef[]).find((row) => row.id === "ring-mail");
    expect(armor?.description).toBeTruthy();
  });

  it("ouvre le paquetage au lieu de le nommer", () => {
    // « Paquetage du clerc » hides a dozen objects; the card is the only place
    // the player sees what they are taking.
    const def: ChoiceDef = {
      id: "class:cleric:equipment",
      source: "class",
      kind: "option",
      label: "Équipement de départ",
      count: 1,
      pool: { kind: "list", values: ["a", "b"] },
    };
    const summary = choiceValueSummary(def, "a", catalogs);
    expect(summary).toContain("Paquetage d'ecclésiastique (");
    expect(summary).toContain("Sac à dos");
  });

  it("laisse les caractéristiques sans glose — le nom suffit", () => {
    expect(choiceValueSummary(defOf("ability"), "wis", catalogs)).toBeUndefined();
  });

  it("ne rend rien tant que le catalogue n'est pas chargé", () => {
    expect(choiceValueSummary(defOf("spell"), "acid-splash", undefined)).toBeUndefined();
  });
});

describe("couverture des résumés de compétence", () => {
  it("couvre les dix-huit, sans doublon", () => {
    const all = SKILLS.map((skill) => SKILL_SUMMARY[skill]);
    expect(all).toHaveLength(18);
    expect(new Set(all).size).toBe(18);
    // A full stop, or a question mark where the line reads better as one.
    for (const summary of all) expect(/[.?]$/.test(summary), summary).toBe(true);
  });
});
