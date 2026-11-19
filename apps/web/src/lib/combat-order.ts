import type { SessionCombat } from "@adventure-keeper/schemas";

// The combat's order, computed the same way whether it is written to
// Firestore or to a realtime room (`live-store.ts`).

/** The next combatant's turn (a new round after the last). */
export function nextTurn(combat: SessionCombat): SessionCombat {
  if (combat.order.length === 0) return combat;
  const turnIndex = (combat.turnIndex + 1) % combat.order.length;
  return { ...combat, turnIndex, round: turnIndex === 0 ? combat.round + 1 : combat.round };
}

/**
 * New combatants slotted in by initiative (ties after those already there),
 * the same combatant keeping its turn.
 */
export function withAdded(
  combat: SessionCombat,
  entries: { id: string; initiative: number }[],
  initiativeById: ReadonlyMap<string, number>,
): SessionCombat {
  const activeId = combat.order[combat.turnIndex];
  const scores = new Map(initiativeById);
  const order = [...combat.order];
  for (const { id, initiative } of entries) {
    scores.set(id, initiative);
    const at = order.findIndex((other) => (scores.get(other) ?? -Infinity) < initiative);
    order.splice(at === -1 ? order.length : at, 0, id);
  }
  return { ...combat, order, turnIndex: Math.max(0, order.indexOf(activeId)) };
}

/** A combatant out of the order; `null` when nobody is left (the combat ends). */
export function withRemoved(combat: SessionCombat, combatantId: string): SessionCombat | null {
  const removedIndex = combat.order.indexOf(combatantId);
  if (removedIndex === -1) return combat;
  const order = combat.order.filter((id) => id !== combatantId);
  if (order.length === 0) return null;
  let turnIndex = combat.turnIndex;
  if (removedIndex < combat.turnIndex) turnIndex -= 1;
  turnIndex = ((turnIndex % order.length) + order.length) % order.length;
  return { ...combat, order, turnIndex };
}
