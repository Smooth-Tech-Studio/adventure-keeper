import type { AdventureParticipantLiveUpdate, SessionCombat } from "@adventure-keeper/schemas";

import { updateParticipant } from "@/lib/adventures";
import { splitParticipantPatch } from "@/lib/realtime/participants";

import type { RoomClient } from "@/lib/realtime/room-client";
import {
  addCombatant,
  removeCombatant,
  setMapReveal,
  setSessionCombat,
  updateCombatant,
  type AddCombatantInput,
} from "@/lib/sessions";

export type CombatantPatch = Parameters<typeof updateCombatant>[4];

/**
 * Where a live session's fast-moving state lives: the combatants, the
 * combat and the fog. Firestore by default; a room of the self-hosted realtime server when
 * the session was started with one (`session.realtime`). The session page
 * writes through this, never caring which.
 */
export interface LiveStore {
  addCombatant(input: AddCombatantInput): Promise<string>;
  updateCombatant(id: string, patch: CombatantPatch): Promise<void>;
  removeCombatant(id: string): Promise<void>;
  /** The whole combat (round, turn, order), or `null` to end it. */
  setCombat(combat: SessionCombat | null): Promise<void>;
  /** A hidden place's whole fog mask (packed), at its grid. */
  setFog(locationId: string, fog: { mask: string; cols: number; rows: number }): Promise<void>;
  /** A character's play state (HP, slots, rolls…), notes and pending XP. */
  updateParticipant(characterId: string, patch: AdventureParticipantLiveUpdate): Promise<void>;
}

export function firestoreLiveStore(
  campaignId: string,
  adventureId: string,
  sessionId: string,
): LiveStore {
  return {
    addCombatant: (input) => addCombatant(campaignId, adventureId, sessionId, input),
    updateCombatant: (id, patch) => updateCombatant(campaignId, adventureId, sessionId, id, patch),
    removeCombatant: (id) => removeCombatant(campaignId, adventureId, sessionId, id),
    setCombat: (combat) => setSessionCombat(campaignId, adventureId, sessionId, combat),
    setFog: (locationId, fog) => setMapReveal(campaignId, adventureId, sessionId, locationId, fog),
    updateParticipant: (characterId, patch) =>
      updateParticipant(campaignId, adventureId, characterId, patch),
  };
}

/** A fresh combatant id, as Firestore would make one. */
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

/**
 * Through the room. A character's play state goes there too once the room
 * has it (the GM's tab brings each one in); notes and pending XP, and a
 * character the room does not have (an older server, a GM not there yet),
 * go to Firestore (`firestore`).
 */
export function roomLiveStore(
  room: RoomClient,
  sessionId: string,
  firestore: LiveStore,
): LiveStore {
  return {
    addCombatant: async ({ onMap, ...input }) => {
      const id = newId();
      // Every field the input carries (an absent one stays absent, as in Firestore).
      const fields = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ) as Omit<AddCombatantInput, "onMap">;
      room.send({
        type: "combatant.add",
        combatant: { x: 0.5, y: 0.5, ...fields, id, sessionId, onMap: onMap ?? false },
      });
      return id;
    },
    updateCombatant: async (id, patch) => room.send({ type: "combatant.update", id, patch }),
    removeCombatant: async (id) => room.send({ type: "combatant.remove", id }),
    setCombat: async (combat) => room.send({ type: "combat.set", combat }),
    setFog: async (locationId, fog) => room.send({ type: "fog.set", locationId, fog }),
    updateParticipant: async (characterId, patch) => {
      if (!room.snapshot.state.participants?.[characterId]) {
        return firestore.updateParticipant(characterId, patch);
      }
      const split = splitParticipantPatch(patch);
      if (split.room) room.send({ type: "participant.update", characterId, patch: split.room });
      if (split.firestore) await firestore.updateParticipant(characterId, split.firestore);
    },
  };
}
