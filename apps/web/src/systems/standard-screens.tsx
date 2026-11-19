import { CHARACTER_SYSTEM_LABELS } from "@adventure-keeper/schemas";

import { StandardCharacterSheet } from "@/components/character/character-sheet/standard-sheet";
import { StandardCharacterForm } from "@/components/character/standard-character-form";
import type { SystemScreens } from "@/systems/screen-types";
import { StandardPanel } from "@/systems/standard-panel";

/** The free sheet's screens: one sheet, one form. */
export const standardScreens: SystemScreens = {
  Sheet: ({ character, showEditLink }) =>
    character.system === "standard" ? (
      <StandardCharacterSheet character={character} showEditLink={showEditLink} />
    ) : null,
  Edit: ({ character }) =>
    character.system === "standard" ? (
      <StandardCharacterForm mode="edit" character={character} />
    ) : null,
  listLine: () => CHARACTER_SYSTEM_LABELS.standard,
  PlayerPanel: StandardPanel,
  creation: {
    title: "Standard",
    steps: ["identity", "notes", "inventory"],
    guided: false,
    // The free sheet is written straight to the account.
    guestCreation: false,
    Create: ({ returnTo }) => <StandardCharacterForm mode="create" returnTo={returnTo} />,
  },
};
