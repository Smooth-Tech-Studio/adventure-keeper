import type { ReactNode } from "react";
import type {
  AdventureLocation,
  LiveSession,
  SessionCombatant,
  SessionMapReveal,
} from "@adventure-keeper/schemas";

import { CombatHud } from "@/components/session/combat-hud";
import { GameClock } from "@/components/session/game-clock";
import { GameDatePill, QuoteButton } from "@/components/session/quote-button";
import { SessionLocationPill } from "@/components/session/session-location-pill";
import { SessionMap } from "@/components/session/session-map";
import { SessionStage } from "@/components/session/session-stage";
import { TurnOrderStrip } from "@/components/session/turn-order-strip";
import type { WithId } from "@/lib/collections";

interface Props {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
  combatants: WithId<SessionCombatant>[];
  combatantsById: Record<string, WithId<SessionCombatant>>;
  /** Fog-of-war reveal state for the current (hidden) location. */
  reveal: WithId<SessionMapReveal> | null;
  /** uid of the viewing player, if any (the GM's projection has none). */
  currentUid?: string;
  actions?: ReactNode;
  className?: string;
  /**
   * A small map (the phone's Jeu tab, where the turn has its own banner):
   * only the place and the time over it.
   */
  compact?: boolean;
  /** Draw the squares (this viewer's choice). */
  showGrid?: boolean;
}

/**
 * The play area as the players see it: read-only map, opaque fog, and the
 * HUD without any control. Shown in the player's session view, and alone in a
 * tab (`carte`) for a second screen or the table's TV.
 */
export function PlayerStage({
  session,
  locations,
  combatants,
  combatantsById,
  reveal,
  currentUid,
  actions,
  className,
  compact = false,
  showGrid = false,
}: Props) {
  const currentLocation = locations.find((l) => l.id === session.currentLocationId);
  const combat = session.combat;

  return (
    <SessionStage
      className={className}
      map={
        <SessionMap
          id="session-map"
          fill
          // A hidden location's own doc carries no map: the session's snapshot does.
          imageUrl={currentLocation?.imageUrl ?? reveal?.imageUrl}
          mapScale={currentLocation?.scale}
          showGrid={showGrid}
          combatants={combatants}
          canEdit={false}
          onMove={() => {}}
          hidden={currentLocation?.hidden ?? false}
          reveal={reveal}
          fogRole="player"
        />
      }
      location={<SessionLocationPill name={currentLocation?.name} />}
      clock={
        <>
          <GameClock value={{ day: session.gameDay, time: session.clockLabel }} />
          {!compact && <GameDatePill value={session.gameDate} />}
          {!compact && (
            <QuoteButton
              session={session}
              speakers={combatants.filter((c) => c.kind === "participant").map((c) => c.name)}
            />
          )}
        </>
      }
      actions={actions}
      turnOrder={
        combat &&
        !compact && (
          <TurnOrderStrip
            id="session-turn-order"
            combat={combat}
            combatantsById={combatantsById}
            className="max-w-full"
          />
        )
      }
      combatHud={
        combat &&
        !compact && (
          <CombatHud
            combat={combat}
            combatantsById={combatantsById}
            canControl={false}
            currentUid={currentUid}
          />
        )
      }
    />
  );
}
