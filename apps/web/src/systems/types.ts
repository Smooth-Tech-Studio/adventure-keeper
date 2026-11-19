import type {
  Character,
  CharacterInput,
  CharacterPersonality,
  CharacterSystem,
  Companion,
  ReadyCharacter,
  SessionCombatant,
} from "@adventure-keeper/schemas";

import type { LicenceNoticeId } from "@/hooks/use-licence-notice";

/**
 * What the session needs to put a character in a fight. A system that has no
 * such value leaves it out, and the session falls back on its own default.
 */
export interface CombatStats {
  armorClass?: number;
  /** Added to the initiative roll; 0 for a system without one. */
  initiativeBonus: number;
  passivePerception?: number;
  /** How many squares the token covers (absent = one). */
  size?: SessionCombatant["size"];
}

/**
 * A rules system, as the application sees it.
 *
 * Screens that are not about one game — campaigns, adventures, sessions, the
 * character list — ask their questions here instead of testing
 * `system === "dnd2024"` or importing the 5e package. Each system answers
 * from its own folder (`systems/dnd2024`, `systems/standard`), the only place
 * that knows its rules. See `docs/RULES_AND_CONTENT.md`, lot 1.
 *
 * A method receives any character and answers for its own: handed a sheet of
 * another system, it gives the neutral answer (no stat, no companion…).
 */
export interface RulesSystem {
  readonly id: CharacterSystem;
  /** The system's name, in the current language. */
  readonly label: string;
  /** The attribution to show while a page displays this system's content. */
  readonly licenceNotice: LicenceNoticeId | null;
  /** Content packs add entries to this system. */
  readonly contentPacks: boolean;
  /** Sheets carry a personality (traits, ideals, bonds, flaws) under their story. */
  readonly personality: boolean;

  /** One line under the character's name: « Elfe · Magicien · niv. 3 ». */
  subtitle(character: ReadyCharacter): string;
  combatStats(character: ReadyCharacter): CombatStats;
  /** Familiars and mounts that follow the character into a fight. */
  companions(character: ReadyCharacter): Companion[];
  personalityOf(character: Character): CharacterPersonality | undefined;
  /** Experience points earned so far; `null` when the system does not count any. */
  experienceOf(character: ReadyCharacter): number | null;

  // --- Storage (`lib/characters.ts`) ---------------------------------------

  /**
   * Complete what is about to be stored with the content it relies on — a
   * sheet keeps its own copy of the pack entries it uses. Drafts included.
   */
  withContent<T extends { system?: string }>(input: T): T;
  /**
   * The values computed from the rules and stored with a finished sheet, so
   * that lists and sessions read them without the rules. None for a system
   * that computes nothing.
   */
  derivedFields(sheet: CharacterInput | ReadyCharacter): Record<string, unknown>;
  /** What a stored sheet must have even when its document predates the field. */
  storedDefaults(sheet: Record<string, unknown>): Record<string, unknown>;
  /** Optional fields to remove from the document when a save leaves them empty. */
  readonly clearableFields: readonly string[];
  /** The parts of a sheet the live session may patch: equipment, purse… */
  readonly sessionFields: readonly string[];

  /** Follow the interface language, for a system whose texts live outside it. */
  setLocale?(language: string): void;
}
