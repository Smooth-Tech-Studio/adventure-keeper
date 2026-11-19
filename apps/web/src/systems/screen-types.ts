import type { ComponentType, ReactNode } from "react";
import type {
  AdventureParticipant,
  AdventureParticipantPlayerUpdate,
  Character,
  Companion,
  LiveSession,
  ReadyCharacter,
  SessionCombatant,
} from "@adventure-keeper/schemas";

import type { CharacterSheetProps } from "@/components/character/character-sheet/types";
import type { CharacterItemsPatch, WithId } from "@/lib/collections";
import type { turnOf } from "@/lib/combat-turn";

export interface OwnerSheetProps {
  character: WithId<ReadyCharacter>;
  onSaved: () => void;
  onSetExperience: (xp: number) => void;
}

export interface CharacterFactsProps {
  character: WithId<ReadyCharacter>;
}

/** A step of a creation, worded under `characters:create.steps.<step>`. */
export type CreationStepKey =
  | "class"
  | "species"
  | "background"
  | "abilities"
  | "equipment"
  | "identity"
  | "notes"
  | "inventory";

/** How a character is created with a system (`/characters/new`). */
export interface SystemCreation {
  /** The system's name in the chooser. */
  title: string;
  /** How the creation goes, step by step. */
  steps: CreationStepKey[];
  /**
   * A guided creation: it takes the whole window, keeps what was entered on
   * the device and can be resumed. Otherwise a form in the page.
   */
  guided: boolean;
  /** A visitor without an account can create; an account saves the result. */
  guestCreation: boolean;
  /** The creation itself. `resume` is what a guided creation left on the device. */
  Create: ComponentType<{ returnTo?: string; resume?: unknown }>;
  /** What the system keeps for the whole page, chooser and creation alike. */
  Scope?: ComponentType<{ campaignId: string | null; children: ReactNode }>;
  /** More to choose before starting — the content packs. Reads `Scope`. */
  ChooserExtras?: ComponentType;
  /** A creation left on the device, in a few words: whose, and how far. */
  describeSnapshot?(state: unknown): { name?: string; detail?: string };
}

/** What a system's character shows in its player's session, for the session view to lay out. */
export interface PlayerSessionBlocks {
  /** Above the tabs of the sheet, on a computer. */
  sheetHeader: ReactNode;
  /** The sheet's tabs on a computer, before « Quêtes et notes ». */
  sheetTabs: {
    id: "actions" | "sorts" | "fiche" | "sac" | "notes";
    label: string;
    content: ReactNode;
  }[];
  /** The tabs already hold the notes: the view adds no « Quêtes et notes » tab. */
  notesInSheet: boolean;
  /** The « Moi » tab, on a phone. */
  me: ReactNode;
  /** Their own tabs on a phone, when the character has any. */
  spells: ReactNode;
  bag: ReactNode;
  /** One figure next to the hit points in the phone's header. */
  phoneStat: ReactNode;
  /** A reminder kept in sight whichever tab is open (a spell being held). */
  banner: ReactNode;
  /** Dialogs the blocks open. */
  dialogs: ReactNode;
}

/** What the session view hands a system to build those blocks. */
export interface PlayerPanelProps {
  session: WithId<LiveSession>;
  combatants: WithId<SessionCombatant>[];
  myParticipant: WithId<AdventureParticipant>;
  myCharacter: WithId<ReadyCharacter>;
  conditionsEnabled: boolean;
  /** Hit points and temporary hit points as shown — written once the clicks stop. */
  hitPoints: number;
  maxHitPoints: number;
  temp: number;
  setHitPoints: (value: number) => void;
  setTemp: (value: number) => void;
  /** The running fight seen from this player, if any. */
  turn: ReturnType<typeof turnOf>;
  /** Open the roll sheet. What a roll is belongs to the system. */
  onRoll: (spec: unknown) => void;
  onNotesChange: (value: string) => void;
  onCharacterItemsChange: (patch: CharacterItemsPatch) => void;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onCashInXp: () => void;
  onApplyLevel: (level: number) => void;
  onEndTurn: () => void;
  onMyCombatantChange: (patch: { armorClass: number; size?: SessionCombatant["size"] }) => void;
  onCompanionCombatantHp: (combatantId: string, value: number) => void;
  onCompanionJoinCombat: (companion: Companion) => Promise<number | undefined>;
  onRemoveCompanionCombatant: (combatantId: string) => void;
  children: (blocks: PlayerSessionBlocks) => ReactNode;
}

/**
 * The screens a rules system brings. A page that shows a character asks for
 * them (`screensOf(character)`) instead of choosing between the components of
 * two systems. Kept apart from `RulesSystem` so that asking a system for its
 * name does not load its sheet.
 */
export interface SystemScreens {
  /** The sheet, read-only. */
  Sheet: ComponentType<CharacterSheetProps>;
  /** The sheet its owner edits in place. Absent: the owner edits through `Edit`. */
  OwnerSheet?: ComponentType<OwnerSheetProps>;
  /** `/characters/:id/edit` — the form, or the creation a draft goes back to. */
  Edit: ComponentType<{ character: WithId<Character> }>;
  /** A finished sheet's line in « Mes personnages ». */
  listLine(character: ReadyCharacter): string;
  /** Badges next to the hit points on a character's card. */
  ListBadges?: ComponentType<CharacterFactsProps>;
  /** Figures under the badges on a character's card. */
  ListFigures?: ComponentType<CharacterFactsProps>;
  creation: SystemCreation;
  /** The character's part of its player's session. */
  PlayerPanel: ComponentType<PlayerPanelProps>;
}
