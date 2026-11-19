import type { SessionCombatant } from "@adventure-keeper/schemas";

/**
 * A token's colour when it has none of its own: red for an enemy, teal for an
 * ally the GM plays (an allied NPC), blue for the party.
 */
export function combatantColor(
  combatant: Pick<SessionCombatant, "color" | "kind" | "ally">,
): string {
  if (combatant.color) return combatant.color;
  if (combatant.kind !== "enemy") return "#2563eb";
  return combatant.ally ? "#0d9488" : "#b91c1c";
}
