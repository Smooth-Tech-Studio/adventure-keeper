/* eslint-disable react-refresh/only-export-components -- context module: provider + hook live together by convention */
import type { GameTime } from "@/lib/game-time";
import { createContext, useContext, type ReactNode } from "react";
import type { AdventureEnemy, AdventureParticipant } from "@adventure-keeper/schemas";
import type { Condition } from "@/systems/dnd2024/vocabulary";

import type { CombatSetupResult } from "@/components/session/combat-setup-dialog";
import type { EnemyFormValues } from "@/components/adventure/enemy-form";
import type { WithId } from "@/lib/collections";

/**
 * The GM-session write surface. Assembled once in `game-session.tsx` (each entry
 * bound to `campaignId` / `adventureId` / `sessionId` and wrapped in `run()`),
 * then read by the session components via {@link useSessionActions} instead of
 * being threaded through as `on*` props.
 */
export interface SessionActions {
  onLocation: (locationId: string | null) => void;
  onSetLocationHidden: (locationId: string, hidden: boolean) => void;
  onClock: (value: GameTime) => void;
  onCombatantHitPoints: (combatantId: string, value: number) => void;
  /** A character's hit points / temporary hit points, set by the GM (and its token's). */
  onParticipantVitals: (
    characterId: string,
    patch: { currentHitPoints?: number; temporaryHitPoints?: number },
  ) => void;
  onToggleCombatantMap: (combatantId: string, onMap: boolean) => void;
  /** Put a character's token on the map, in combat or not (made on first placing). */
  onPlaceParticipant: (participant: WithId<AdventureParticipant>) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  onRemoveCombatant: (id: string) => void;
  onAddParticipantCombatant: (participant: WithId<AdventureParticipant>) => void;
  onAddEnemyCombatant: (enemy: WithId<AdventureEnemy>) => void;
  onCreateCombat: (result: CombatSetupResult) => void;
  /** Reinforcements: add enemies to the running combat's initiative order. */
  onAddEnemiesToCombat: (result: CombatSetupResult) => void;
  onCreateEnemy: (values: EnemyFormValues) => Promise<WithId<AdventureEnemy>>;
  onNext: () => void;
  onEndCombat: () => void;
  onDestroyCombatant: (id: string) => void;
  onAwardXp: (characterId: string, delta: number) => void;
  onSetParticipantState: (
    characterId: string,
    patch: { conditions?: Condition[]; exhaustion?: number; heroicInspiration?: boolean },
  ) => void;
  onSetCombatantConditions: (id: string, conditions: Condition[]) => void;
  onCommitFog: (mask: string, cols: number, rows: number) => void;
}

const SessionActionsContext = createContext<SessionActions | null>(null);

export function SessionActionsProvider({
  value,
  children,
}: {
  value: SessionActions;
  children: ReactNode;
}) {
  return <SessionActionsContext.Provider value={value}>{children}</SessionActionsContext.Provider>;
}

export function useSessionActions(): SessionActions {
  const actions = useContext(SessionActionsContext);
  if (!actions) {
    throw new Error("useSessionActions must be used within a <SessionActionsProvider>");
  }
  return actions;
}
