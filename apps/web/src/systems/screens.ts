import type { CharacterSystem } from "@adventure-keeper/schemas";

import { dnd2024Screens } from "@/systems/dnd2024/screens";
import type { SystemScreens } from "@/systems/screen-types";
import { standardScreens } from "@/systems/standard-screens";

export type { CharacterFactsProps, OwnerSheetProps, SystemScreens } from "@/systems/screen-types";

const SCREENS: Record<CharacterSystem, SystemScreens> = {
  standard: standardScreens,
  dnd2024: dnd2024Screens,
};

export function getScreens(id: CharacterSystem): SystemScreens {
  return SCREENS[id];
}

/** The screens of the system a character is built with. */
export function screensOf(character: { system: CharacterSystem }): SystemScreens {
  return SCREENS[character.system];
}
