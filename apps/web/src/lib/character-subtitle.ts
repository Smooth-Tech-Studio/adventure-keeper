import type { ReadyCharacter } from "@adventure-keeper/schemas";

import { systemOf } from "@/systems";

/** "Elfe · Magicien · niv. 3", or the system name for a standard sheet. */
export function characterSubtitle(character: ReadyCharacter): string {
  return systemOf(character).subtitle(character);
}
