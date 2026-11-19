import {
  ROOM_PARTICIPANT_FIELDS,
  type AdventureParticipant,
  type AdventureParticipantLiveUpdate,
  type RoomParticipant,
  type RoomParticipantLive,
} from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";

const ROOM_FIELDS = new Set<string>(ROOM_PARTICIPANT_FIELDS);

/** The play state a participant doc holds, as the room keeps it (absent fields left out). */
export function roomFieldsOf(source: Partial<AdventureParticipant>): RoomParticipantLive {
  return Object.fromEntries(
    ROOM_PARTICIPANT_FIELDS.flatMap((field) =>
      source[field] === undefined ? [] : [[field, source[field]]],
    ),
  ) as RoomParticipantLive;
}

/** A participant write, split: what goes to the room, what stays in Firestore (notes, XP). */
export function splitParticipantPatch(patch: AdventureParticipantLiveUpdate): {
  room: RoomParticipantLive | null;
  firestore: AdventureParticipantLiveUpdate | null;
} {
  const room: Record<string, unknown> = {};
  const firestore: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    (ROOM_FIELDS.has(field) ? room : firestore)[field] = value;
  }
  return {
    room: Object.keys(room).length ? (room as RoomParticipantLive) : null,
    firestore: Object.keys(firestore).length ? (firestore as AdventureParticipantLiveUpdate) : null,
  };
}

/** The participants as Firestore has them, with the room's play state over them. */
export function withRoomParticipants(
  participants: WithId<AdventureParticipant>[],
  room: Record<string, RoomParticipant> | undefined,
): WithId<AdventureParticipant>[] {
  if (!room) return participants;
  return participants.map((participant) => {
    const live = room[participant.characterId];
    if (!live) return participant;
    // The room says who plays it only for its rights: Firestore has the final word.
    const { playerId: _playerId, ...state } = live;
    return { ...participant, ...state };
  });
}

/**
 * Every character's play state the room holds, whole: what the session's end
 * writes back (no diff to trust then — the session is over).
 */
export function roomParticipantsSnapshot(
  room: Record<string, RoomParticipant> | undefined,
  participants: WithId<AdventureParticipant>[],
): { characterId: string; patch: RoomParticipantLive }[] {
  if (!room) return [];
  return participants.flatMap(({ characterId }) => {
    const live = room[characterId];
    return live ? [{ characterId, patch: roomFieldsOf(live) }] : [];
  });
}

/**
 * What the room knows that Firestore does not yet: per character, the fields
 * that differ. Only characters Firestore still has (one removed from the
 * adventure is not brought back).
 */
export function participantsToSave(
  room: Record<string, RoomParticipant> | undefined,
  participants: WithId<AdventureParticipant>[],
): { characterId: string; patch: RoomParticipantLive }[] {
  if (!room) return [];
  const saves: { characterId: string; patch: RoomParticipantLive }[] = [];
  for (const participant of participants) {
    const live = room[participant.characterId];
    if (!live) continue;
    const patch: Record<string, unknown> = {};
    for (const field of ROOM_PARTICIPANT_FIELDS) {
      if (live[field] === undefined) continue;
      if (JSON.stringify(live[field]) !== JSON.stringify(participant[field])) {
        patch[field] = live[field];
      }
    }
    if (Object.keys(patch).length) {
      saves.push({ characterId: participant.characterId, patch: patch as RoomParticipantLive });
    }
  }
  return saves;
}
