import type { Companion, Dnd2024Character, EnemyAttack } from "@adventure-keeper/schemas";
import {
  abilityModifier,
  beastStats,
  formatDistance,
  getMonster,
  hasWildShape,
  type MonsterDef,
} from "@adventure-keeper/system-dnd2024";

import { monsterEnemyAttacks } from "@/components/adventure/drafts";
import { tr } from "@/i18n";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";

/** The spell that calls a familiar. */
export const FIND_FAMILIAR = "find-familiar";

/**
 * Whether the character can call a familiar: they know « Appel de familier »
 * (cast or granted — the Warlock's Pacte de la chaîne grants it), or they are a
 * druid with « Compagnon sauvage ».
 */
export function canSummonFamiliar(character: Dnd2024Character): boolean {
  const spells = [
    ...(character.spells ?? []),
    ...(character.grantedSpells ?? []).map((g) => g.spellId),
  ];
  return (
    spells.includes(FIND_FAMILIAR) ||
    (character.eldritchInvocations ?? []).some(
      (pick) => (typeof pick === "string" ? pick : pick.id) === "pact-of-the-chain",
    ) ||
    hasWildShape(character.classId, character.level ?? 1)
  );
}

/** A fresh familiar copying a beast's numbers, under the name the player gave it. */
export function familiarFromMonster(monster: MonsterDef, name: string, id: string): Companion {
  const stats = beastStats(monster.id);
  return {
    id,
    kind: "familiar",
    name: name.trim() || monster.name,
    monsterId: monster.id,
    formName: monster.name,
    armorClass: monster.armorClass,
    maxHitPoints: monster.hitPoints,
    currentHitPoints: monster.hitPoints,
    speed: monster.speed,
    dexModifier: stats ? abilityModifier(stats.dex) : 0,
    attacks: monsterEnemyAttacks(monster.id),
  };
}

/** The combatant `refId` of a companion: `"<characterId>:<companionId>"`. */
export const companionRefId = (characterId: string, companionId: string) =>
  `${characterId}:${companionId}`;

/** The character a companion combatant belongs to. */
export const companionOwnerId = (refId: string) => refId.split(":")[0];

/** An attack line as the roll sheet takes it: the attack, then its damage on a hit. */
export function attackRoll(owner: string, attack: EnemyAttack): RollSpec | null {
  const label = `${owner} · ${attack.name}`;
  const damage: RollSpec | undefined = attack.damage
    ? { label, kind: "degats", bonus: attack.damageBonus ?? 0, pool: attack.damage }
    : undefined;
  if (attack.toHit !== undefined)
    return { label, kind: "attaque", bonus: attack.toHit, next: damage };
  return damage ?? null;
}

/** The beast a druid has become, its numbers read from the bank. */
export function wildShapeBeast(monsterId: string) {
  const monster = getMonster(monsterId);
  if (!monster) return null;
  return {
    monster,
    stats: beastStats(monster.id),
    attacks: monsterEnemyAttacks(monster.id),
  };
}

/** One beast's movement, in words: « 12 m, escalade 9 m ». */
export function beastMovement(monster: MonsterDef): string {
  const stats = beastStats(monster.id);
  return [
    formatDistance(monster.speed),
    stats?.climb && tr("session:familiar.climb", { speed: formatDistance(stats.climb) }),
    stats?.swim && tr("session:familiar.swim", { speed: formatDistance(stats.swim) }),
    stats?.fly && tr("session:familiar.fly", { speed: formatDistance(stats.fly) }),
  ]
    .filter(Boolean)
    .join(", ");
}
