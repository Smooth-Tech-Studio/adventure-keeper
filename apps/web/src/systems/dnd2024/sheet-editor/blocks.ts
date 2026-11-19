import { equipmentOwnerOf, type ChoiceDef } from "@adventure-keeper/system-dnd2024";

import type { EditBlock } from "@/components/character/character-sheet/types";
import {
  stateChoiceDefs,
  type FormErrorKey,
  type FormState,
} from "@/systems/dnd2024/character-form/state";
import { tr } from "@/i18n";

/**
 * Which edit panel shows a choice. The level feats sit with the abilities they
 * raise, skills and tools with the other proficiencies, and everything else
 * (subclass, fighting style, lineage, origin feats and their picks) under
 * « Choix de classe et d'origine ». A starting package is never shown: on a
 * finished sheet it would change nothing — the equipment is edited directly.
 */
export function choiceBlock(def: ChoiceDef): EditBlock | null {
  if (equipmentOwnerOf(def.id) !== undefined) return null;
  if (def.source === "level") return "abilities";
  if (def.kind === "skill") return "skills";
  if (def.kind === "tool") return "proficiencies";
  return "options";
}

/** The choices of one block, open for this state. */
export function blockDefs(state: FormState, block: EditBlock): ChoiceDef[] {
  return stateChoiceDefs(state).filter((def) => choiceBlock(def) === block);
}

/** The form fields each block owns, besides its choices. */
export const BLOCK_FIELDS: Record<EditBlock, (keyof FormState)[]> = {
  identity: ["name", "color", "image"],
  abilities: ["base", "bonuses", "hitPointRolls"],
  skills: ["skillExpertise"],
  proficiencies: ["languages", "toolExpertise"],
  options: [],
  spells: ["cantrips", "spells", "eldritchInvocations", "pactWeaponId"],
  equipment: ["weapons", "armors", "tools", "inventory", "money", "weaponMasteries"],
  wildShape: ["wildShapeForms"],
  lore: ["lore"],
};

/** The validation messages that belong to a block. */
export const BLOCK_ERRORS: Record<EditBlock, FormErrorKey[]> = {
  identity: ["name"],
  abilities: ["base", "bonuses"],
  skills: ["skills", "speciesSkills"],
  proficiencies: ["toolProficiencies"],
  options: ["speciesChoice"],
  spells: ["invocations"],
  equipment: ["weaponMasteries"],
  wildShape: [],
  lore: [],
};

export const EDIT_BLOCKS = Object.keys(BLOCK_FIELDS) as EditBlock[];

/** A stable fingerprint of what a block holds, to tell a change. */
function blockFingerprint(
  state: FormState,
  block: EditBlock,
  defs: Map<string, ChoiceDef>,
): string {
  const picks = state.choices
    .filter((pick) => {
      const def = defs.get(pick.choiceId);
      return def ? choiceBlock(def) === block : false;
    })
    .sort((a, b) => a.choiceId.localeCompare(b.choiceId));
  return JSON.stringify([BLOCK_FIELDS[block].map((key) => state[key]), picks]);
}

/** The blocks whose content differs between the saved sheet and the draft. */
export function modifiedBlocks(saved: FormState, draft: FormState): Set<EditBlock> {
  const defs = new Map(
    [...stateChoiceDefs(saved), ...stateChoiceDefs(draft)].map((def) => [def.id, def]),
  );
  return new Set(
    EDIT_BLOCKS.filter(
      (block) => blockFingerprint(saved, block, defs) !== blockFingerprint(draft, block, defs),
    ),
  );
}

/** A panel's title — the same as the sheet's pencil labels (`sheet:layout.blocks`). */
export const panelTitle = (block: EditBlock) => tr(`sheet:layout.blocks.${block}`);

/** « Pourquoi ce choix ? » — our words, one per panel (`sheet:editor.help`). */
export const panelHelp = (block: EditBlock) => tr(`sheet:editor.help.${block}`);
