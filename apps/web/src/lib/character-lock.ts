import type { Adventure, AdventureParticipant, WithId } from "@adventure-keeper/schemas";

/**
 * Whether a character may leave a player's roster in a campaign.
 *
 * A player keeps every character they bring into a campaign (`characterIds`),
 * and picks which is active for the next adventures — that switch is always
 * free: an adventure in progress keeps the participant it started with. What
 * is held is **removing** a character while an adventure it plays in is in
 * progress (active, or a session is live); its death there (three failed death
 * saves) releases it. Should the table need an exception, the GM removes it
 * from the adventure's participants.
 *
 * Nothing is stored for this: it is read off the adventures and participants
 * (`loadCharacterHolds` in `adventures.ts`). This module stays pure.
 */

/** An adventure is in progress once active, or while a session is live. */
export function adventureInProgress(adventure: Pick<Adventure, "status" | "liveSessionId">) {
  return adventure.status === "active" || Boolean(adventure.liveSessionId);
}

/** Three failed death saves: the character died in that adventure. */
export function diedIn(participant: Pick<AdventureParticipant, "deathSaves">): boolean {
  return (participant.deathSaves?.failures ?? 0) >= 3;
}

export interface CharacterEngagement {
  adventure: WithId<Adventure>;
  participant: AdventureParticipant;
}

/** The adventure in progress that holds a character, from those it takes part in. Pure. */
export function holdingAdventure(
  engagements: readonly CharacterEngagement[],
): WithId<Adventure> | null {
  return (
    engagements.find(
      ({ adventure, participant }) => adventureInProgress(adventure) && !diedIn(participant),
    )?.adventure ?? null
  );
}
