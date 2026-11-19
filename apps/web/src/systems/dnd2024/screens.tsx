import { Navigate } from "react-router-dom";
import { isCharacterDraft, isDnd2024Character } from "@adventure-keeper/schemas";
import { getClass, getSpecies } from "@adventure-keeper/system-dnd2024";

import { tr } from "@/i18n";
import { ListBadges, ListFigures } from "@/systems/dnd2024/components/character-list-facts";
import type { WizardSnapshot } from "@/hooks/use-wizard-autosave";
import type { FormState } from "@/systems/dnd2024/character-form/state";
import { CreationWizard } from "@/systems/dnd2024/creation-wizard";
import {
  CreationPackChoice,
  CreationPacksScope,
} from "@/systems/dnd2024/creation-wizard/creation-packs";
import { Dnd2024CharacterSheet } from "@/systems/dnd2024/sheet/dnd2024-sheet";
import { SheetEditor } from "@/systems/dnd2024/sheet-editor";
import { Dnd2024PlayerPanel } from "@/systems/dnd2024/session/player-panel";
import type { SystemScreens } from "@/systems/screen-types";

/** 5e 2024's screens, as the pages reach them (`screensOf`). */
export const dnd2024Screens: SystemScreens = {
  Sheet: ({ character, ...rest }) =>
    isDnd2024Character(character) ? (
      <Dnd2024CharacterSheet character={character} {...rest} />
    ) : null,

  // The owner edits a finished sheet in place, block by block.
  OwnerSheet: ({ character, onSaved, onSetExperience }) =>
    isDnd2024Character(character) ? (
      <SheetEditor character={character} onSaved={onSaved} onSetExperience={onSetExperience} />
    ) : null,

  Edit: ({ character }) => {
    if (!isDnd2024Character(character)) return null;
    // A draft has never been playable: it belongs back in the guided
    // creation, at the step it was left on. A finished sheet is edited on the
    // sheet itself.
    return isCharacterDraft(character) ? (
      <CreationWizard character={character} />
    ) : (
      <Navigate to={`/characters/${character.id}`} replace />
    );
  },

  listLine: (character) =>
    isDnd2024Character(character)
      ? tr("characters:list.dndLine", {
          species: getSpecies(character.speciesId)?.name ?? character.speciesId,
          class: getClass(character.classId)?.name ?? character.classId,
          level: character.level ?? 1,
        })
      : "",

  ListBadges,
  ListFigures,
  PlayerPanel: Dnd2024PlayerPanel,

  creation: {
    title: "Compatible 5E (2024)",
    steps: ["class", "species", "background", "abilities", "equipment"],
    guided: true,
    // The creation runs on the device; signing up saves it.
    guestCreation: true,
    Create: ({ returnTo, resume }) => (
      <CreationWizard
        returnTo={returnTo}
        resume={resume as WizardSnapshot<FormState> | undefined}
      />
    ),
    Scope: CreationPacksScope,
    ChooserExtras: CreationPackChoice,
    describeSnapshot(state) {
      const { name, classId, level } = state as FormState;
      const klass = classId ? getClass(classId) : undefined;
      return {
        name,
        detail: klass && tr("characters:create.classLevel", { class: klass.name, level }),
      };
    },
  },
};
