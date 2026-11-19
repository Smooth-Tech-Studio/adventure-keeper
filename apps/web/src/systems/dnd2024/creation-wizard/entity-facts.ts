import type { CSSProperties } from "react";
import type { ClassDef } from "@adventure-keeper/system-dnd2024";
import { tr } from "@/i18n";

/**
 * Plain-language lines about a class, shared by the carousel card, the class
 * sub-step and the final review.
 */

export function armorTrainingText(klass: ClassDef): string {
  return (
    klass.armorTraining.map((category) => tr(`wizard:facts.armor.${category}`)).join(", ") ||
    tr("wizard:facts.noArmor")
  );
}

export function weaponTrainingText(klass: ClassDef): string {
  switch (klass.weaponProficiency.martial) {
    case true:
      return tr("wizard:facts.weapons.all");
    case "light":
      return tr("wizard:facts.weapons.light");
    case "finesse-or-light":
      return tr("wizard:facts.weapons.finesseOrLight");
    default:
      return tr("wizard:facts.weapons.simple");
  }
}

export type ClassRole = "martial" | "caster" | "hybrid";

export function classRole(klass: ClassDef, isSpellcaster: (id: string) => boolean): ClassRole {
  // Half casters: weapons first, a little magic on the side.
  if (klass.spellcasting === "half") return "hybrid";
  return isSpellcaster(klass.id) ? "caster" : "martial";
}

/**
 * Until real illustrations exist, each class, species and background gets a
 * tinted area with its initial. The hue is chosen so neighbours in the carousel
 * do not look alike; a content-pack entry gets one derived from its id.
 */
const HUES: Record<string, number> = {
  barbarian: 25,
  bard: 330,
  cleric: 85,
  druid: 140,
  sorcerer: 15,
  fighter: 240,
  wizard: 265,
  monk: 195,
  warlock: 300,
  paladin: 60,
  ranger: 160,
  rogue: 280,
  dragonborn: 35,
  elf: 150,
  gnome: 300,
  goliath: 220,
  halfling: 95,
  human: 60,
  dwarf: 45,
  orc: 130,
  tiefling: 350,
  acolyte: 80,
  criminal: 280,
  sage: 230,
  soldier: 30,
  custom: 200,
};

export function hueOf(id: string): number {
  if (id in HUES) return HUES[id];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export const hueStyle = (id: string) => ({ "--hue": hueOf(id) }) as CSSProperties;

/**
 * Position of card `index` relative to the centre one, on a loop: with twelve
 * cards, the last one sits just left of the first. Ties (an even deck's far
 * side) go to the right.
 */
export function circularOffset(index: number, focus: number, length: number): number {
  const raw = (((index - focus) % length) + length) % length;
  return raw > length / 2 ? raw - length : raw;
}
