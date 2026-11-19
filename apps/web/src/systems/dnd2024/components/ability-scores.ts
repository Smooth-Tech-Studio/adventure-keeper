import type { Ability } from "@adventure-keeper/system-dnd2024";

export type AbilityScoreDraft = Record<Ability, number | null>;
export type AbilityBonusDraft = Record<Ability, number>;

export const EMPTY_SCORES: AbilityScoreDraft = {
  str: null,
  dex: null,
  con: null,
  int: null,
  wis: null,
  cha: null,
};

export const EMPTY_BONUSES: AbilityBonusDraft = {
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0,
};
