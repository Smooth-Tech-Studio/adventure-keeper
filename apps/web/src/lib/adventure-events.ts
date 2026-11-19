import { deleteField, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import {
  COLLECTIONS,
  adventureEventSchema,
  type AdventureEvent,
  type RevealedEvent,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { adventureCollectionRef, adventureSubCollection } from "@/lib/adventure-crud";
import type { WithId } from "@adventure-keeper/schemas";

const events = adventureSubCollection<AdventureEvent>(COLLECTIONS.events, {
  ordered: true,
  schema: adventureEventSchema,
});

export interface EventInput {
  title: string;
  description: string;
  trigger: string;
  /** Due on the game clock: day and / or `HH:MM`. */
  dueDay?: number;
  dueTime?: string;
}

export const listEvents = events.list;
export const subscribeEvents = events.subscribe;
export const deleteEvent = events.remove;

export async function addEvent(
  campaignId: string,
  adventureId: string,
  input: EventInput,
  order?: number,
): Promise<string> {
  return events.add(campaignId, adventureId, {
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    trigger: input.trigger.trim() || undefined,
    dueDay: input.dueDay,
    dueTime: input.dueTime || undefined,
    isRevealed: false,
    order: order ?? (await events.nextOrder(campaignId, adventureId)),
  });
}

export function updateEvent(
  campaignId: string,
  adventureId: string,
  eventId: string,
  input: EventInput,
): Promise<void> {
  return events.patch(campaignId, adventureId, eventId, {
    title: input.title.trim(),
    description: input.description.trim() || deleteField(),
    trigger: input.trigger.trim() || deleteField(),
    dueDay: input.dueDay ?? deleteField(),
    dueTime: input.dueTime || deleteField(),
  });
}

/** Swap the `order` of two events (move up / down). */
export async function swapEventOrder(
  campaignId: string,
  adventureId: string,
  a: WithId<AdventureEvent>,
  b: WithId<AdventureEvent>,
): Promise<void> {
  await Promise.all([
    events.patch(campaignId, adventureId, a.id, { order: b.order }),
    events.patch(campaignId, adventureId, b.id, { order: a.order }),
  ]);
}

function snapshotOf(event: WithId<AdventureEvent>): RevealedEvent {
  return {
    eventId: event.id,
    title: event.title,
    ...(event.description ? { description: event.description } : {}),
  };
}

/**
 * Reveal (or hide again) a story beat during a live session. The event is
 * flagged and snapshot onto the session, so the chronicle can show it after
 * players lose access to the adventure's content.
 */
export async function setEventRevealed(
  campaignId: string,
  adventureId: string,
  sessionId: string,
  event: WithId<AdventureEvent>,
  revealed: boolean,
): Promise<void> {
  const eventRef = events.ref(campaignId, adventureId, event.id);
  // Hiding it again edits the session it was revealed in, which may be an earlier one.
  const targetSessionId = revealed ? sessionId : (event.revealedSessionId ?? sessionId);
  const sessionRef = doc(
    adventureCollectionRef(campaignId, adventureId, COLLECTIONS.liveSessions),
    targetSessionId,
  );
  await runTransaction(db, async (tx) => {
    const session = await tx.get(sessionRef);
    if (session.exists()) {
      const others = ((session.data().revealedEvents ?? []) as RevealedEvent[]).filter(
        (e) => e.eventId !== event.id,
      );
      tx.update(sessionRef, {
        revealedEvents: revealed ? [...others, snapshotOf(event)] : others,
        updatedAt: serverTimestamp(),
      });
    }
    tx.update(eventRef, {
      isRevealed: revealed,
      revealedSessionId: revealed ? sessionId : deleteField(),
      updatedAt: serverTimestamp(),
    });
  });
}
