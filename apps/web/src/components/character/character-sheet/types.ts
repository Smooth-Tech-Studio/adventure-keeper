import type { ReactNode } from "react";
import type { ReadyCharacter } from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";

export interface CharacterSheetProps {
  character: WithId<ReadyCharacter>;
  /** Show the "Modifier" link (owner only). */
  showEditLink?: boolean;
  /** Owner-only: persist a new XP total. */
  onSetExperience?: (xp: number) => void;
  /** Owner-only: apply an explicit level-up. */
  onApplyLevel?: (level: number) => void;
  /** The character's story, shown in the « Histoire » and « Journal » tabs. */
  story?: SheetStory;
  /**
   * Who reads the sheet. A `companion` — another player of the campaign — does
   * not see the inventory, the purse nor the XP; the owner and the GM see all.
   */
  audience?: SheetAudience;
}

export type SheetAudience = "owner" | "gm" | "companion";

/** The owner's story cards, built by the page (they load and save their own data). */
export interface SheetStory {
  /** The personality (5e), under the backstory. */
  personality: ReactNode;
  chapters: ReactNode;
  chapterCount: number;
  journal: ReactNode;
  journalCount: number;
}

/** The parts of a 5e 2024 sheet its owner can open in an edit panel. */
export type EditBlock =
  | "identity"
  | "abilities"
  | "skills"
  | "proficiencies"
  | "options"
  | "spells"
  | "equipment"
  | "wildShape"
  | "lore";

/** Where a feature comes from — one block each in « Capacités ». */
export type SheetOrigin = "class" | "subclass" | "species" | "background" | "feats";

/**
 * Owner-only pencils on the sheet's blocks, and the menu of bigger changes. The
 * review at the end of the creation uses the same sheet: « Modifier » buttons
 * that lead back to a step of the wizard, and the blocks still to complete
 * outlined.
 */
export interface SheetEditing {
  onEdit: (block: EditBlock) => void;
  /**
   * Each origin block leads to its own step (the review). Left out, an origin
   * block opens the « options » panel — and species or background, changed
   * through the bigger « rebuild », have no pencil.
   */
  onEditOrigin?: (origin: SheetOrigin) => void;
  /** Blocks changed and not saved yet — marked on the sheet. */
  modified: ReadonlySet<EditBlock>;
  /** Replaces the « Modifier » link: change of class or origin, abilities, skills. */
  actions: ReactNode;
  /** Blocks opened from `actions` rather than a pencil: none on the sheet (the review keeps its own). */
  menuBlocks?: ReadonlySet<EditBlock>;
  /** The review of the creation: labelled « Modifier » buttons rather than pencils. */
  review?: boolean;
  /** The review: blocks still to complete, outlined. */
  todo?: ReadonlySet<EditBlock | SheetOrigin>;
}

/** A block still to complete, at the review of the creation. */
export function isTodo(editing: SheetEditing | undefined, key: EditBlock | SheetOrigin) {
  return editing?.todo?.has(key) ?? false;
}
