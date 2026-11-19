/** Local helpers shared by the adventure-creation / detail editors. */

import { monsterAttacks } from "@/systems/dnd2024/vocabulary";
import type { EnemyAttack } from "@adventure-keeper/schemas";

/** Bank monster attacks → the `EnemyAttack` shape stored on an enemy. */
export function monsterEnemyAttacks(monsterId: string): EnemyAttack[] {
  return monsterAttacks(monsterId).map((atk) => ({
    name: atk.name,
    toHit: atk.toHit,
    reach: atk.reach,
    damage: atk.damage,
    damageBonus: atk.damageBonus,
    damageKind: atk.damageKind,
    notes: atk.note,
  }));
}

let counter = 0;
/** A stable-per-render local key for an unsaved draft row. */
export function draftKey(): string {
  counter += 1;
  return `d${Date.now().toString(36)}-${counter}`;
}
