import { describe, expect, it } from "vitest";
import { ABILITIES, ABILITY_LABELS, ABILITY_SUMMARY } from "./abilities";
import { ALIGNMENTS, ALIGNMENT_LABELS, ALIGNMENT_SUMMARY } from "./alignments";
import { BACKGROUNDS } from "./backgrounds";
import { FEATS, featsOfCategory } from "./feats";
import { CLASSES } from "./classes";
import { LANGUAGES } from "./languages";
import { SKILLS, SKILL_LABELS, SKILL_SUMMARY } from "./skills";
import { SPECIES } from "./species";
import { SPELL_SCHOOLS, SPELL_SCHOOL_LABELS, SPELL_SCHOOL_SUMMARY } from "./spells";
import { SUBCLASSES } from "./subclasses";

/**
 * The one-line descriptions shown on the creation cards. They exist so a player
 * can choose without the rulebook open, so an empty or stub blurb is a defect —
 * and an over-long one stops being a card and starts being a paragraph.
 */
describe("accroches de création", () => {
  const all = [
    ...CLASSES.map((row) => ["classe", row.name, row.blurb] as const),
    ...SPECIES.map((row) => ["espèce", row.name, row.blurb] as const),
    ...BACKGROUNDS.map((row) => ["historique", row.name, row.blurb] as const),
    ...SUBCLASSES.map((row) => ["sous-classe", row.name, row.blurb] as const),
  ];

  it("couvre les 38 choix d'entité", () => {
    // 16 historiques du livre, plus le personnalisé.
    expect(all).toHaveLength(12 + 9 + 5 + 12);
  });

  it("donne à chacun une phrase utile, ni vide ni interminable", () => {
    for (const [kind, name, blurb] of all) {
      expect(blurb.length, `${kind} ${name}`).toBeGreaterThan(40);
      expect(blurb.length, `${kind} ${name}`).toBeLessThan(140);
      expect(blurb.trim(), `${kind} ${name}`).toBe(blurb);
      expect(blurb.endsWith("."), `${kind} ${name}`).toBe(true);
    }
  });

  it("n'écrit pas deux fois la même accroche", () => {
    const seen = all.map(([, , blurb]) => blurb);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("accroches de dons", () => {
  it("couvre les dons généraux et les faveurs épiques", () => {
    for (const feat of [...featsOfCategory("general"), ...featsOfCategory("epic")]) {
      expect(feat.blurb, feat.id).toBeTruthy();
    }
  });

  it("laisse les dons d'origine et les styles sans accroche — leur résumé suffit", () => {
    for (const feat of [...featsOfCategory("origin"), ...featsOfCategory("fightingStyle")]) {
      expect(feat.blurb, feat.id).toBeUndefined();
    }
  });

  it("garde l'accroche nettement plus courte que la règle qu'elle résume", () => {
    for (const feat of FEATS) {
      if (!feat.blurb) continue;
      expect(feat.blurb.length, feat.id).toBeGreaterThan(25);
      expect(feat.blurb.length, feat.id).toBeLessThan(90);
      expect(feat.blurb.length, feat.id).toBeLessThan(feat.summary.length);
      expect(feat.blurb.endsWith("."), feat.id).toBe(true);
    }
  });

  it("n'écrit pas deux fois la même accroche de don", () => {
    const blurbs = FEATS.map((feat) => feat.blurb).filter(Boolean);
    expect(new Set(blurbs).size).toBe(blurbs.length);
  });
});

/**
 * The same promise, one level down: a player picking two languages or two
 * skills should not have to guess from the name alone.
 */
describe("résumés de langues et de compétences", () => {
  it("décrit les 19 langues", () => {
    expect(LANGUAGES).toHaveLength(19);
    for (const language of LANGUAGES) {
      expect(language.summary.length, language.name).toBeGreaterThan(40);
      expect(language.summary.length, language.name).toBeLessThan(140);
      expect(language.summary.endsWith("."), language.name).toBe(true);
    }
  });

  it("décrit les 18 compétences", () => {
    for (const skill of SKILLS) {
      const summary = SKILL_SUMMARY[skill];
      expect(summary.length, SKILL_LABELS[skill]).toBeGreaterThan(40);
      expect(summary.length, SKILL_LABELS[skill]).toBeLessThan(140);
      // A question mark closes « est-ce qu'on vous ment ? » just as well.
      expect(summary, SKILL_LABELS[skill]).toMatch(/[.?]$/);
    }
  });

  it("dit à quoi sert chacune des six caractéristiques", () => {
    for (const ability of ABILITIES) {
      const summary = ABILITY_SUMMARY[ability];
      expect(summary.length, ABILITY_LABELS[ability]).toBeGreaterThan(40);
      expect(summary.length, ABILITY_LABELS[ability]).toBeLessThan(140);
      expect(summary, ABILITY_LABELS[ability]).toMatch(/[.?]$/);
    }
  });

  it("explique les neuf alignements", () => {
    for (const alignment of ALIGNMENTS) {
      const summary = ALIGNMENT_SUMMARY[alignment];
      expect(summary.length, ALIGNMENT_LABELS[alignment]).toBeGreaterThan(40);
      expect(summary.length, ALIGNMENT_LABELS[alignment]).toBeLessThan(140);
      expect(summary, ALIGNMENT_LABELS[alignment]).toMatch(/[.?]$/);
    }
  });

  it("dit ce que fait chacune des huit écoles de magie", () => {
    for (const school of SPELL_SCHOOLS) {
      const summary = SPELL_SCHOOL_SUMMARY[school];
      expect(summary.length, SPELL_SCHOOL_LABELS[school]).toBeGreaterThan(40);
      expect(summary.length, SPELL_SCHOOL_LABELS[school]).toBeLessThan(140);
      expect(summary, SPELL_SCHOOL_LABELS[school]).toMatch(/[.?]$/);
    }
  });

  it("n'écrit pas deux fois le même résumé", () => {
    const all = [
      ...LANGUAGES.map((row) => row.summary),
      ...Object.values(SKILL_SUMMARY),
      ...Object.values(ABILITY_SUMMARY),
      ...Object.values(ALIGNMENT_SUMMARY),
      ...Object.values(SPELL_SCHOOL_SUMMARY),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});

/**
 * A species choice (lineage, ancestry, legacy) is picked on cards: each option
 * must say what it brings, or the player picks a colour or a name blind.
 */
describe("options d'espèce", () => {
  it("décrivent chacune ce qu'elles apportent", () => {
    const missing: string[] = [];
    for (const species of SPECIES) {
      for (const option of species.choice?.options ?? []) {
        const summary = species.lineages?.[option]?.summary ?? "";
        if (summary.length < 40 || !summary.endsWith("."))
          missing.push(`${species.name} › ${option}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
