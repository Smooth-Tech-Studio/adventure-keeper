import type { SessionCombat, SessionCombatant } from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";

export interface PlayerTurn {
  combat: SessionCombat;
  /** The combatant whose turn it is (absent if removed meanwhile). */
  active: WithId<SessionCombatant> | undefined;
  /** Whether it is this player's character — or their familiar. */
  mine: boolean;
}

/** Whose turn it is in the running fight, as one player sees it; `null` out of combat. */
export function turnOf(
  combat: SessionCombat | undefined,
  combatantsById: Record<string, WithId<SessionCombatant>>,
  myCharacterId: string,
): PlayerTurn | null {
  if (!combat || combat.order.length === 0) return null;
  const active = combatantsById[combat.order[combat.turnIndex]];
  const mine =
    !!active &&
    ((active.kind === "participant" && active.refId === myCharacterId) ||
      (active.kind === "companion" && active.refId.startsWith(`${myCharacterId}:`)));
  return { combat, active, mine };
}
