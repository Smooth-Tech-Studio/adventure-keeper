import type { AdventureLocation } from "@adventure-keeper/schemas";

/** What a player may see of a location outside the play area. */
export interface PlayerLocation {
  id: string;
  name: string;
  /** Absent for a hidden location: its map is only uncovered under the fog. */
  imageUrl?: string;
}

/**
 * A location as the adventure page shows it to a player: the description is
 * the GM's, and a hidden location's map would show what the fog still covers.
 */
export function playerLocationView(
  location: Pick<AdventureLocation, "name" | "imageUrl" | "hidden"> & { id: string },
): PlayerLocation {
  return {
    id: location.id,
    name: location.name,
    imageUrl: location.hidden ? undefined : location.imageUrl,
  };
}
