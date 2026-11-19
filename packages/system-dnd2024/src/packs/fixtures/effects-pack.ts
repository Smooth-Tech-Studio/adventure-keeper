/**
 * Test-only pack: invented feats carrying each mechanical effect the engine
 * folds into a number, so the engine stays covered now that the feats which
 * had them in the code (Robuste, Duel, Maître d'hast…) live in a private pack.
 * Ids resolve as `"essai:<slug>"` — see {@link essai}.
 */

import { parseContentPack } from "../parse";
import { createContentOverlay } from "../registry";
import type { ContentPack } from "../schema";

const result = parseContentPack({
  format: "ak-pack/1",
  system: "dnd2024",
  id: "essai",
  name: "Dons d'essai",
  content: {
    feats: [
      {
        id: "costaud",
        name: "Carrure d'essai",
        category: "general",
        minLevel: 4,
        summary: "+1 en Constitution, pour tester un +1 sans choix.",
        abilityIncrease: { options: ["con"] },
      },
      {
        id: "robuste",
        name: "Robustesse d'essai",
        category: "origin",
        summary: "Deux points de vie de plus par niveau, pour les tests.",
        effects: { hitPointsPerLevel: 2 },
      },
      {
        id: "bagarreur",
        name: "Bagarre d'essai",
        category: "origin",
        summary: "Coups à mains nues à 1d4, pour les tests du moteur.",
        effects: { unarmedDamageDice: { count: 1, die: "d4" } },
        combatNote: "Bagarre d'essai : coups à mains nues à 1d4.",
      },
      {
        id: "musicien",
        name: "Musique d'essai",
        category: "origin",
        summary: "Trois instruments au choix, pour tester les choix d'un don.",
        choices: [
          {
            id: "instruments",
            kind: "tool",
            label: "Instruments",
            count: 3,
            pool: { kind: "group", group: "instrument" },
          },
        ],
      },
      {
        id: "duel",
        name: "Duel d'essai",
        category: "fightingStyle",
        summary: "+2 aux dégâts avec une arme de corps à corps à une main, pour les tests.",
        effects: { duelingDamageBonus: 2 },
        combatNote: "Duel d'essai : +2 aux dégâts à une main (déjà appliqué).",
      },
      {
        id: "lancer",
        name: "Lancer d'essai",
        category: "fightingStyle",
        summary: "+2 aux dégâts d'une arme de lancer lancée, pour les tests.",
        effects: { thrownDamageBonus: 2 },
      },
      {
        id: "armes-lourdes",
        name: "Armes lourdes d'essai",
        category: "general",
        minLevel: 4,
        summary: "Bonus de maîtrise aux dégâts des armes lourdes, pour les tests.",
        effects: { heavyWeaponProficiencyDamage: true },
        bonusAction: "Abattage d'essai (après un critique)",
      },
      {
        id: "hast",
        name: "Hast d'essai",
        category: "general",
        minLevel: 4,
        summary: "Une frappe en plus avec le manche, pour les tests.",
        bonusAction: "Frappe double d'essai (manche, d4 contondant)",
      },
    ],
  },
});
if (!result.ok) throw new Error(result.errors.join("\n"));

export const EFFECTS_PACK: ContentPack = result.pack;
export const EFFECTS = createContentOverlay([EFFECTS_PACK]);

/** `"essai:<slug>"` — the id a feat of the test pack is known by. */
export const essai = (slug: string) => `essai:${slug}`;
