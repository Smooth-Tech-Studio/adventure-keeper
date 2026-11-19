import type { AdventureLocation, MapScale } from "@adventure-keeper/schemas";

import { emptyLootDraft, lootToDraft, type PlannedLootDraft } from "@/lib/planned-loot";
import type { WithId } from "@/lib/collections";

export interface LocationFormValues {
  name: string;
  description: string;
  imageUrl: string;
  hidden: boolean;
  /** Measured on the map preview; dropped when the image changes. */
  scale?: MapScale;
  loot: PlannedLootDraft;
}

export const emptyLocationForm = (): LocationFormValues => ({
  name: "",
  description: "",
  imageUrl: "",
  hidden: false,
  loot: emptyLootDraft(),
});

export function locationToForm(location: WithId<AdventureLocation>): LocationFormValues {
  return {
    name: location.name,
    description: location.description ?? "",
    imageUrl: location.imageUrl ?? "",
    hidden: location.hidden ?? false,
    scale: location.scale,
    loot: lootToDraft(location.loot),
  };
}
