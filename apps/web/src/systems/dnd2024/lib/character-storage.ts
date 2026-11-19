/**
 * What a 5e 2024 sheet stores besides what its player entered: the block
 * computed from the rules, and its own copy of the pack entries it uses.
 * `lib/characters.ts` reaches these through the system (`@/systems`).
 */

import {
  type Character,
  type Dnd2024Character,
  type Dnd2024CharacterInput,
  type WithId,
} from "@adventure-keeper/schemas";
import {
  activeContent,
  computeCharacterDerived,
  createContentOverlay,
  extractUsedContent,
  mergeContentPacks,
  type ChoicePick,
  type ContentPack,
} from "@adventure-keeper/system-dnd2024";

/**
 * Recompute the denormalised 5e block. `level` overrides the input's level.
 * Pack content is read from the sheet's own copy (`packContent`), not from the
 * packs currently active: a stored sheet must not change with them. A sheet
 * with no copy yet — an older sheet, waiting for its owner's next save —
 * reads the active packs instead.
 */
export function dnd2024Derived(input: Dnd2024CharacterInput, level?: number) {
  const packs = input.packContent ?? [];
  const options = packs.length ? { content: createContentOverlay(packs) } : {};
  return computeCharacterDerived(
    {
      classId: input.classId,
      level: level ?? input.level,
      baseAbilityScores: input.baseAbilityScores,
      backgroundAbilityBonuses: input.backgroundAbilityBonuses,
      backgroundId: input.backgroundId,
      speciesId: input.speciesId,
      speciesChoice: input.speciesChoice,
      size: input.size,
      speciesSpellAbility: input.speciesSpellAbility,
      eldritchInvocations: input.eldritchInvocations,
      pactWeaponId: input.pactWeaponId,
      skillProficiencies: input.skillProficiencies,
      speciesSkillProficiencies: input.speciesSkillProficiencies,
      skillExpertise: input.skillExpertise,
      hitPointRolls: input.hitPointRolls,
      weapons: input.weapons,
      armors: input.armors,
      tools: input.tools,
      toolProficiencies: input.toolProficiencies,
      toolExpertise: input.toolExpertise,
      weaponMasteries: input.weaponMasteries,
      choices: input.choices,
    },
    options,
  );
}

/** The pack entries a set of sheets carries — to make them visible while those sheets are shown. */
export function packContentOf(characters: readonly Character[]): ContentPack[] {
  return characters.flatMap((character) =>
    character.system === "dnd2024" ? (character.packContent ?? []) : [],
  );
}

/** The fields of a sheet (finished or draft) that can point into a content pack. */
interface PackReferences {
  system?: string;
  classId?: string;
  speciesId?: string;
  backgroundId?: string;
  cantrips?: string[];
  spells?: string[];
  toolProficiencies?: string[];
  toolExpertise?: string[];
  tools?: { catalogId?: string }[];
  choices?: ChoicePick[];
  eldritchInvocations?: readonly (string | { id: string })[];
  languages?: readonly string[];
  packContent?: ContentPack[];
}

/**
 * Refresh the sheet's copy of the pack entries it uses: its class, species,
 * background, spells and every picked value (subclass, feats…), plus what
 * those entries pull in. Read from the packs active right now — the player's
 * library, campaign packs — and from the copy the sheet already had, so an
 * entry from a pack no longer shared is kept rather than lost.
 */
export function withPackContent<T extends PackReferences>(input: T): T {
  if (input.system !== "dnd2024") return input;
  const sources = mergeContentPacks([
    ...(activeContent()?.sourcePacks ?? []),
    ...(input.packContent ?? []),
  ]);
  const used = [
    input.classId,
    input.speciesId,
    input.backgroundId,
    ...(input.cantrips ?? []),
    ...(input.spells ?? []),
    ...(input.toolProficiencies ?? []),
    ...(input.toolExpertise ?? []),
    ...(input.tools ?? []).map((tool) => tool.catalogId),
    ...(input.choices ?? []).flatMap((pick) => pick.values),
    ...(input.eldritchInvocations ?? []).map((pick) => (typeof pick === "string" ? pick : pick.id)),
    ...(input.languages ?? []),
  ].filter((id): id is string => Boolean(id));
  return { ...input, packContent: extractUsedContent(sources, used) };
}

/**
 * The sheet a creation would save, built without saving it — the review at the
 * end of the wizard shows it. Same pack content and derived block as
 * `createCharacter`; no id, owner nor dates yet.
 */
export function previewDnd2024Character(
  rawInput: Dnd2024CharacterInput,
  id: string,
): WithId<Dnd2024Character> {
  const input = withPackContent(rawInput);
  return {
    ...input,
    ...dnd2024Derived(input),
    id,
    status: "ready",
  } as unknown as WithId<Dnd2024Character>;
}
