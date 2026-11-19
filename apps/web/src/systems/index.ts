import {
  CHARACTER_SYSTEMS,
  characterSystemSatisfies,
  type CharacterSystem,
} from "@adventure-keeper/schemas";

import { dnd2024System } from "@/systems/dnd2024";
import { standardSystem } from "@/systems/standard";
import type { RulesSystem } from "@/systems/types";

export type { CombatStats, RulesSystem } from "@/systems/types";

const SYSTEMS: Record<CharacterSystem, RulesSystem> = {
  standard: standardSystem,
  dnd2024: dnd2024System,
};

export function getSystem(id: CharacterSystem): RulesSystem {
  return SYSTEMS[id];
}

export function isCharacterSystem(value: unknown): value is CharacterSystem {
  return (CHARACTER_SYSTEMS as readonly unknown[]).includes(value);
}

/** Tell every system which language the interface is in. */
export function setSystemsLocale(language: string): void {
  for (const system of Object.values(SYSTEMS)) system.setLocale?.(language);
}

/** The system a character — or anything that names one — is built with. */
export function systemOf(character: { system: CharacterSystem }): RulesSystem {
  return SYSTEMS[character.system];
}

/**
 * The sheets a game is played with: a campaign names its game (« 5e »,
 * « maison »…), and the game decides between the computed sheet and the free one.
 */
export function characterSystemFor(game: string): CharacterSystem {
  return game === "dnd5e" ? "dnd2024" : "standard";
}

/**
 * The one system whose sheets a campaign accepts, or `null` when several do —
 * a « standard » campaign also takes 5e sheets, so the player gets to choose.
 */
export function soleSystemFor(required: CharacterSystem): CharacterSystem | null {
  const accepted = CHARACTER_SYSTEMS.filter((id) => characterSystemSatisfies(id, required));
  return accepted.length === 1 ? accepted[0] : null;
}
