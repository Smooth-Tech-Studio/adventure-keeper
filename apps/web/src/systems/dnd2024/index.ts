import { CHARACTER_SYSTEM_LABELS, ZERO_MONEY, isDnd2024Character } from "@adventure-keeper/schemas";
import { getClass, getSpecies, setLocale } from "@adventure-keeper/system-dnd2024";

import { dnd2024Derived, withPackContent } from "@/systems/dnd2024/lib/character-storage";

import type { RulesSystem } from "@/systems/types";

/**
 * 5e 2024, as the application sees it. This folder is where the 5e package
 * is meant to be imported from; the rest of the application goes through
 * `RulesSystem` (`docs/RULES_AND_CONTENT.md`, lot 1).
 */
export const dnd2024System: RulesSystem = {
  id: "dnd2024",
  get label() {
    return CHARACTER_SYSTEM_LABELS.dnd2024;
  },
  licenceNotice: "srd521",
  contentPacks: true,
  personality: true,

  subtitle(character) {
    if (!isDnd2024Character(character)) return CHARACTER_SYSTEM_LABELS.dnd2024;
    const species = getSpecies(character.speciesId)?.name ?? character.speciesId;
    const klass = getClass(character.classId)?.name ?? character.classId;
    return `${species} · ${klass} · niv. ${character.level ?? 1}`;
  },

  combatStats(character) {
    if (!isDnd2024Character(character)) return { initiativeBonus: 0 };
    const dex = character.abilityModifiers.dex;
    return {
      // A sheet derived before these fields existed has Dexterity alone.
      armorClass: character.armorClass ?? 10 + dex,
      initiativeBonus: character.initiativeBonus ?? dex,
      passivePerception: character.passivePerception,
      size: character.size,
    };
  },

  companions: (character) => (isDnd2024Character(character) ? (character.companions ?? []) : []),

  personalityOf: (character) => (isDnd2024Character(character) ? character.personality : undefined),

  experienceOf: (character) =>
    isDnd2024Character(character) ? (character.experiencePoints ?? 0) : null,

  withContent: withPackContent,
  derivedFields: (sheet) => (isDnd2024Character(sheet) ? dnd2024Derived(sheet) : {}),
  storedDefaults: (sheet) => ({ money: sheet.money ?? ZERO_MONEY }),
  clearableFields: [
    "speciesChoice",
    "size",
    "speciesSpellAbility",
    "pactWeaponId",
    "lore",
    "color",
    "imageUrl",
    "imageCrop",
  ],
  sessionFields: [
    "weapons",
    "armors",
    "tools",
    "inventory",
    "money",
    "companions",
    "wildShapeForms",
  ],

  setLocale,
};
