import { deleteField } from "firebase/firestore";
import { COLLECTIONS, adventureNpcSchema, type AdventureNpc } from "@adventure-keeper/schemas";

import { adventureSubCollection } from "@/lib/adventure-crud";

const npcs = adventureSubCollection<AdventureNpc>(COLLECTIONS.npcs, {
  ordered: true,
  schema: adventureNpcSchema,
});

export interface CreateNpcInput {
  name: string;
  personality?: string;
  lore?: string;
  locationId?: string;
  color?: string;
  /** The enemy profile the NPC fights with, as an ally. */
  enemyId?: string;
}

export const listNpcs = npcs.list;
export const deleteNpc = npcs.remove;

export async function addNpc(
  campaignId: string,
  adventureId: string,
  input: CreateNpcInput,
  order?: number,
): Promise<string> {
  return npcs.add(campaignId, adventureId, {
    name: input.name,
    personality: input.personality?.trim() || undefined,
    lore: input.lore?.trim() || undefined,
    locationId: input.locationId,
    color: input.color,
    enemyId: input.enemyId,
    order: order ?? (await npcs.nextOrder(campaignId, adventureId)),
  });
}

export function updateNpc(
  campaignId: string,
  adventureId: string,
  npcId: string,
  values: {
    name: string;
    personality: string;
    lore: string;
    locationId?: string;
    enemyId?: string;
  },
): Promise<void> {
  return npcs.patch(campaignId, adventureId, npcId, {
    name: values.name.trim(),
    personality: values.personality.trim() || deleteField(),
    lore: values.lore.trim() || deleteField(),
    locationId: values.locationId || deleteField(),
    enemyId: values.enemyId || deleteField(),
  });
}
