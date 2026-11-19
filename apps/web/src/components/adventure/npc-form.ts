import type { AdventureNpc } from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";

export interface NpcFormValues {
  name: string;
  personality: string;
  lore: string;
  /** Location id / draft key, or "" for none. */
  locationId: string;
  /** The enemy profile it fights with (an ally in combat), or "" for none. */
  enemyId: string;
}

export const emptyNpcForm = (): NpcFormValues => ({
  name: "",
  personality: "",
  lore: "",
  locationId: "",
  enemyId: "",
});

export function npcToForm(npc: WithId<AdventureNpc>): NpcFormValues {
  return {
    name: npc.name,
    personality: npc.personality ?? "",
    lore: npc.lore ?? "",
    locationId: npc.locationId ?? "",
    enemyId: npc.enemyId ?? "",
  };
}
