import { z } from "zod";
import type { DamageKind } from "./spells";
import type { Die } from "./dice";
import { CREATURE_SIZES, CREATURE_SIZE_ABBR, type CreatureSize } from "./species";
import { activeContent } from "./packs/active";
import { localized, translateTree, type Shadow } from "./locale";
import SRD_MONSTERS from "./srd/monsters.json";

/**
 * A curated bank of common SRD monsters, used to pre-fill an
 * `AdventureEnemy` stat block. French names, essential fields only — the GM
 * tweaks the rest. `speed` is the main movement speed in feet.
 */
export const MONSTER_TYPES = [
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
] as const;
export type MonsterType = (typeof MONSTER_TYPES)[number];
export const monsterTypeSchema = z.enum(MONSTER_TYPES);

export const MONSTER_TYPE_LABELS: Record<MonsterType, string> = localized({
  fr: {
    aberration: "Aberration",
    beast: "Bête",
    celestial: "Céleste",
    construct: "Artificiel",
    dragon: "Dragon",
    elemental: "Élémentaire",
    fey: "Fée",
    fiend: "Fiélon",
    giant: "Géant",
    humanoid: "Humanoïde",
    monstrosity: "Monstruosité",
    ooze: "Vase",
    plant: "Plante",
    undead: "Mort-vivant",
  },
  en: {
    aberration: "Aberration",
    beast: "Beast",
    celestial: "Celestial",
    construct: "Construct",
    dragon: "Dragon",
    elemental: "Elemental",
    fey: "Fey",
    fiend: "Fiend",
    giant: "Giant",
    humanoid: "Humanoid",
    monstrosity: "Monstrosity",
    ooze: "Ooze",
    plant: "Plant",
    undead: "Undead",
  },
});

export interface MonsterDef {
  id: string;
  name: string;
  type: MonsterType;
  size: CreatureSize;
  /** Challenge rating as written, e.g. "1/4", "5". */
  cr: string;
  armorClass: number;
  hitPoints: number;
  /** Main movement speed in feet. */
  speed: number;
  /** Its attacks, in the simple model (see {@link MonsterAttack}). */
  attacks?: MonsterAttack[];
  /**
   * Strength, Dexterity, Constitution and other speeds, for a beast a
   * character can turn into or call (Wild Shape, familiars — `beasts.ts`).
   */
  beast?: { str: number; dex: number; con: number; climb?: number; swim?: number; fly?: number };
}

export const monsterIdSchema = z.string().min(1);

/** The SRD monsters, read from `srd/monsters.json` (the pack format) — attacks included. */
export const MONSTERS: MonsterDef[] = SRD_MONSTERS.entries as unknown as MonsterDef[];

{
  const english = SRD_MONSTERS.translations.en as Record<string, Shadow>;
  MONSTERS.forEach((monster) => translateTree(monster, { en: english[monster.id] }));
}

const MONSTER_BY_ID = new Map(MONSTERS.map((monster) => [monster.id, monster]));

export function getMonster(id: string): MonsterDef | undefined {
  return activeContent()?.monsters.get(id) ?? MONSTER_BY_ID.get(id);
}

/** The built-in monsters, then those of the active content packs. */
export function allMonsters(): MonsterDef[] {
  const packs = activeContent()?.monsters;
  return packs ? [...MONSTERS, ...packs.values()] : MONSTERS;
}

export interface MonsterAttack {
  name: string;
  toHit: number;
  /** Reach / range as written, e.g. "1,50 m" or "24/96 m". */
  reach?: string;
  damage: { count: number; die: Die };
  damageBonus: number;
  damageKind: DamageKind;
  /** Multiattack, saving throws, extra damage — the simple model's escape hatch. */
  note?: string;
}

/** Reference attacks for a bank monster (empty when none are recorded). */
export function monsterAttacks(id: string): MonsterAttack[] {
  return getMonster(id)?.attacks ?? [];
}

/** Monster type + size, e.g. "Humanoïde · M · FP 1/2". */
export function monsterMeta(monster: MonsterDef): string {
  return `${MONSTER_TYPE_LABELS[monster.type]} · ${CREATURE_SIZE_ABBR[monster.size]} · FP ${monster.cr}`;
}

/** Sizes actually present in the bank and active packs, smallest first — what a size filter should offer. */
export function monsterSizes(): CreatureSize[] {
  const present = new Set(allMonsters().map((monster) => monster.size));
  return CREATURE_SIZES.filter((size) => present.has(size));
}
