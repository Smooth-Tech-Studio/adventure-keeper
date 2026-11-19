import type { CharacterSheetProps } from "@/components/character/character-sheet/types";
import { screensOf } from "@/systems/screens";

export type { CharacterSheetProps };

/** Read-only character sheet — the one its rules system brings. */
export function CharacterSheet(props: CharacterSheetProps) {
  const { Sheet } = screensOf(props.character);
  return <Sheet {...props} />;
}
