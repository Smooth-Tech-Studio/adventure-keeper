import { useMemo } from "react";
import {
  computeCharacterDerived,
  createContentOverlay,
  type ContentPack,
  type AbilityBonusBlock,
  type AbilityScoreBlock,
  type ArmorItemLike,
  type CharacterDerived,
  type ChoicePick,
  type HitPointRoll,
  type InvocationPick,
  type ToolItemLike,
  type WeaponItemLike,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";
import { useContentPacks } from "@/systems/dnd2024/hooks/use-content-packs";

export interface CharacterDerivedSource {
  classId: string;
  level?: number;
  baseAbilityScores: AbilityScoreBlock;
  backgroundAbilityBonuses: AbilityBonusBlock;
  backgroundId?: string;
  speciesId?: string;
  speciesChoice?: string;
  speciesSpellAbility?: string;
  eldritchInvocations?: readonly (InvocationPick | string)[];
  pactWeaponId?: string;
  skillProficiencies?: string[];
  speciesSkillProficiencies?: string[];
  skillExpertise?: string[];
  hitPointRolls?: readonly HitPointRoll[];
  weapons?: WeaponItemLike[];
  armors?: ArmorItemLike[];
  tools?: ToolItemLike[];
  toolProficiencies?: string[];
  toolExpertise?: string[];
  weaponMasteries?: string[];
  /** Resolved player choices — the subclass and the feats are read back from them. */
  choices?: readonly ChoicePick[];
  /**
   * The content-pack entries a saved sheet carries. Non-empty = derive from
   * them alone (plus the SRD); absent or empty = whatever packs are active
   * (the creation form, or an older sheet that has not been saved since it
   * started using a pack).
   */
  packContent?: readonly ContentPack[];
}

/**
 * Memoised 5e 2024 derived block (scores, modifiers, max HP, AC, speed,
 * skills, tool checks, weapon attacks…). Shared by the character sheet and the
 * creation form's live preview.
 */
export function useCharacterDerived(source: CharacterDerivedSource): CharacterDerived {
  const { overlay } = useContentPacks();
  // The block carries texts (attack names, combat notes) in the reader's language.
  const { i18n } = useTranslation();
  // Without a copy of its own, the result depends on the active packs.
  const ownCopy = source.packContent?.length ? source.packContent : undefined;
  const activePacks = ownCopy ? null : overlay;
  return useMemo(
    () =>
      computeCharacterDerived(source, ownCopy ? { content: createContentOverlay(ownCopy) } : {}),
    // Depend on the fields, not the `source` object — callers may pass a fresh
    // object literal each render (e.g. the creation form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      source.classId,
      source.level,
      source.baseAbilityScores,
      source.backgroundAbilityBonuses,
      source.backgroundId,
      source.speciesId,
      source.speciesChoice,
      source.speciesSpellAbility,
      source.eldritchInvocations,
      source.pactWeaponId,
      source.skillProficiencies,
      source.speciesSkillProficiencies,
      source.skillExpertise,
      source.hitPointRolls,
      source.weapons,
      source.armors,
      source.tools,
      source.toolProficiencies,
      source.toolExpertise,
      source.weaponMasteries,
      source.choices,
      source.packContent,
      activePacks,
      i18n.language,
    ],
  );
}
