/**
 * The part of the 5e package the rest of the application reads directly.
 *
 * Some features are not about one sheet but are shaped by 5e all the same:
 * an enemy has six abilities and a size, a fight hands out 5e conditions, a
 * purse counts 5e coins. Until those features are described by the system
 * (`docs/RULES_AND_CONTENT.md`), they take their vocabulary here — the exact
 * list of what they use, and nothing else. Code inside `systems/dnd2024`
 * imports the package itself.
 */

export {
  ABILITIES,
  ABILITIES_BY_LABEL,
  ABILITY_ABBR,
  ABILITY_LABELS,
  ALIGNMENT_LABELS,
  CONDITIONS_BY_LABEL,
  CONDITION_LABELS,
  CREATURE_SIZES,
  CREATURE_SIZE_ABBR,
  CREATURE_SIZE_LABELS,
  DAMAGE_KINDS,
  DAMAGE_KIND_LABELS,
  MONSTER_TYPE_LABELS,
  SKILLS,
  SKILLS_BY_LABEL,
  SKILL_LABELS,
  abilityModifier,
  allMonsters,
  feetToMetres,
  formatCoinPrice,
  formatDicePool,
  formatDistance,
  getBackground,
  getClass,
  getMonster,
  getSpecies,
  hasWildShape,
  metresToFeet,
  monsterAttacks,
  monsterSizes,
  packText,
  withLocale,
} from "@adventure-keeper/system-dnd2024";
export type {
  Ability,
  Condition,
  ContentPack,
  CreatureSize,
  MonsterDef,
  MonsterType,
  PackContentKind,
  SpellDef,
} from "@adventure-keeper/system-dnd2024";
