import type { AdventureParticipant } from "@adventure-keeper/schemas";
import { describe, expect, it } from "vitest";

import type { WithId } from "@/lib/collections";

import {
  participantsToSave,
  roomFieldsOf,
  splitParticipantPatch,
  withRoomParticipants,
} from "./participants";

const thorin = {
  id: "thorin",
  campaignId: "c1",
  adventureId: "a1",
  characterId: "thorin",
  playerId: "bob",
  characterName: "Thorin",
  currentHitPoints: 12,
  notes: "Se méfier du nain",
  pendingXp: 50,
  spellSlotsUsed: { "1": 1 },
} as unknown as WithId<AdventureParticipant>;

describe("roomFieldsOf", () => {
  it("keeps the play state, not the notes, the XP or who it is", () => {
    expect(roomFieldsOf(thorin)).toEqual({ currentHitPoints: 12, spellSlotsUsed: { "1": 1 } });
  });
});

describe("splitParticipantPatch", () => {
  it("sends the play state to the room, notes and XP to Firestore", () => {
    expect(splitParticipantPatch({ currentHitPoints: 3, concentration: null, notes: "x" })).toEqual(
      { room: { currentHitPoints: 3, concentration: null }, firestore: { notes: "x" } },
    );
    expect(splitParticipantPatch({ pendingXp: 0 })).toEqual({
      room: null,
      firestore: { pendingXp: 0 },
    });
  });
});

describe("withRoomParticipants", () => {
  it("shows the room's state over Firestore's", () => {
    const [merged] = withRoomParticipants([thorin], {
      thorin: { playerId: "someone-else", currentHitPoints: 4, temporaryHitPoints: 2 },
    });
    expect(merged).toMatchObject({
      currentHitPoints: 4,
      temporaryHitPoints: 2,
      notes: "Se méfier du nain",
      playerId: "bob",
    });
  });

  it("leaves Firestore's as it is without a room, or a character the room does not have", () => {
    expect(withRoomParticipants([thorin], undefined)).toEqual([thorin]);
    expect(withRoomParticipants([thorin], {})).toEqual([thorin]);
  });
});

describe("participantsToSave", () => {
  it("writes only what changed, for characters Firestore still has", () => {
    expect(
      participantsToSave(
        {
          thorin: {
            playerId: "bob",
            currentHitPoints: 7,
            spellSlotsUsed: { "1": 1 },
            concentration: null,
          },
          gone: { playerId: "carol", currentHitPoints: 1 },
        },
        [thorin],
      ),
    ).toEqual([{ characterId: "thorin", patch: { currentHitPoints: 7, concentration: null } }]);
  });

  it("writes nothing when Firestore is up to date", () => {
    expect(
      participantsToSave(
        { thorin: { playerId: "bob", currentHitPoints: 12, spellSlotsUsed: { "1": 1 } } },
        [thorin],
      ),
    ).toEqual([]);
  });
});
