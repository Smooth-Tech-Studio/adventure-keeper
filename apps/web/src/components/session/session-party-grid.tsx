import type {
  AdventureParticipant,
  ReadyCharacter,
  SessionCombatant,
} from "@adventure-keeper/schemas";

import { ParticipantMiniCard } from "@/components/session/participant-mini-card";
import type { WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";

interface Props {
  participants: WithId<AdventureParticipant>[];
  charactersById: Record<string, WithId<ReadyCharacter>>;
  /** `refId → combatant` so a placed token's live HP / AC wins over the sheet's. */
  combatantByRef: Map<string, WithId<SessionCombatant>>;
  /** GM only — open the inspect dialog for this character. */
  onSelect?: (characterId: string) => void;
  emptyLabel: string;
  /** GM only — show each character's passive Perception next to the AC. */
  showPassivePerception?: boolean;
  /**
   * `strip` (default): a short band under the map. `column`: the map isn't on
   * this screen, so the party gets a column of its own (on wide screens).
   */
  layout?: "strip" | "column";
  className?: string;
}

/** Participant mini-cards, shared by the GM and player session views. */
export function SessionPartyGrid({
  participants,
  charactersById,
  combatantByRef,
  onSelect,
  emptyLabel,
  showPassivePerception,
  layout = "strip",
  className,
}: Props) {
  return (
    <div
      id="session-party"
      className={cn(
        "grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3",
        layout === "strip"
          ? "lg:max-h-[22vh] lg:overflow-y-auto xl:grid-cols-4"
          : "content-start lg:min-h-0 lg:grid-cols-1 lg:overflow-y-auto",
        className,
      )}
    >
      {participants.length === 0 && <p className="text-muted-foreground text-sm">{emptyLabel}</p>}
      {participants.map((participant) => (
        <ParticipantMiniCard
          key={participant.id}
          participant={participant}
          character={charactersById[participant.characterId]}
          combatant={combatantByRef.get(participant.characterId)}
          showPassivePerception={showPassivePerception}
          onClick={onSelect ? () => onSelect(participant.characterId) : undefined}
        />
      ))}
    </div>
  );
}
