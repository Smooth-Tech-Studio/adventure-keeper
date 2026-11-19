import { createHash, timingSafeEqual } from "node:crypto";
import type {
  RoomCombatant,
  RoomOp,
  RoomParticipant,
  RoomState,
  ServerMessage,
} from "@adventure-keeper/schemas";

/** Who sends an op: their Firebase uid, and whether they hold the GM key. */
export interface Actor {
  uid: string;
  gm: boolean;
}

/** What a room keeps on disk: its keys (hashed) and its state. */
export interface RoomRecord {
  id: string;
  memberKeyHash: string;
  gmKeyHash: string;
  state: RoomState;
  updatedAt: string;
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export const emptyState = (): RoomState => ({
  combatants: {},
  combat: null,
  fog: {},
  participants: {},
});

/** What only the GM sets on a character: a player sees them, read-only. */
const GM_ONLY_PARTICIPANT_FIELDS = ["conditions", "exhaustion"] as const;

/**
 * One live session's room: the combatants and the combat, and who may change
 * what — the same rights as `firestore.rules`. The GM changes anything; a
 * player moves tokens, sets HP and conditions, plays the turn order, and adds
 * or removes **their own** familiar only. Only the GM paints the fog. A
 * player changes their own character's play state, but for the conditions
 * and exhaustion the GM sets.
 */
export class Room {
  constructor(public record: RoomRecord) {
    // Rooms saved before the fog, or the participants, came to the server.
    record.state.fog ??= {};
    record.state.participants ??= {};
  }

  /** A new room: created by whoever brings both keys (the GM). */
  static create(id: string, memberKey: string, gmKey: string, now = new Date()): Room {
    return new Room({
      id,
      memberKeyHash: hashKey(memberKey),
      gmKeyHash: hashKey(gmKey),
      state: emptyState(),
      updatedAt: now.toISOString(),
    });
  }

  /** `null` when the member key is wrong; else whether the GM key is right too. */
  admit(memberKey: string, gmKey: string | undefined): { gm: boolean } | null {
    if (!sameHash(hashKey(memberKey), this.record.memberKeyHash)) return null;
    return { gm: gmKey !== undefined && sameHash(hashKey(gmKey), this.record.gmKeyHash) };
  }

  get state(): RoomState {
    return this.record.state;
  }

  private get participants(): Record<string, RoomParticipant> {
    return (this.state.participants ??= {});
  }

  /**
   * No combatant, combat or fog yet: the GM seeds it from Firestore. The
   * participants are not counted: they come in on their own (`participant.track`).
   */
  get empty(): boolean {
    return (
      Object.keys(this.state.combatants).length === 0 &&
      this.state.combat === null &&
      Object.keys(this.state.fog).length === 0
    );
  }

  /**
   * Apply a change. Returns the messages to send everyone, or the reason it
   * was refused (nothing changed then).
   */
  apply(actor: Actor, op: RoomOp, now = new Date()): ServerMessage[] | { error: string } {
    const stamp = now.toISOString();
    const state = this.state;
    switch (op.type) {
      case "combatant.add": {
        const { combatant } = op;
        if (state.combatants[combatant.id]) return { error: "combatant exists" };
        if (!actor.gm && !(combatant.kind === "companion" && combatant.playerId === actor.uid)) {
          return { error: "forbidden" };
        }
        const added: RoomCombatant = { ...combatant, createdAt: stamp, updatedAt: stamp };
        state.combatants[combatant.id] = added;
        this.touch(stamp);
        return [{ type: "combatant", combatant: added }];
      }
      case "combatant.update": {
        const current = state.combatants[op.id];
        if (!current) return { error: "no such combatant" };
        const updated: RoomCombatant = { ...current, ...op.patch, updatedAt: stamp };
        state.combatants[op.id] = updated;
        this.touch(stamp);
        return [{ type: "combatant", combatant: updated }];
      }
      case "combatant.remove": {
        const current = state.combatants[op.id];
        if (!current) return [];
        if (!actor.gm && !(current.kind === "companion" && current.playerId === actor.uid)) {
          return { error: "forbidden" };
        }
        delete state.combatants[op.id];
        this.touch(stamp);
        return [{ type: "combatant.removed", id: op.id }];
      }
      case "combat.set": {
        state.combat = op.combat;
        this.touch(stamp);
        return [{ type: "combat", combat: op.combat }];
      }
      case "fog.set": {
        if (!actor.gm) return { error: "forbidden" };
        state.fog[op.locationId] = op.fog;
        this.touch(stamp);
        return [{ type: "fog", locationId: op.locationId, fog: op.fog }];
      }
      case "participant.track": {
        if (!actor.gm) return { error: "forbidden" };
        // Already here: the room is ahead of Firestore.
        if (this.participants[op.characterId]) return [];
        this.participants[op.characterId] = op.participant;
        this.touch(stamp);
        return [{ type: "participant", characterId: op.characterId, participant: op.participant }];
      }
      case "participant.update": {
        const current = this.participants[op.characterId];
        if (!current) return { error: "no such participant" };
        if (!actor.gm) {
          if (current.playerId !== actor.uid) return { error: "forbidden" };
          if (GM_ONLY_PARTICIPANT_FIELDS.some((field) => field in op.patch)) {
            return { error: "forbidden" };
          }
        }
        const updated: RoomParticipant = { ...current, ...op.patch };
        this.participants[op.characterId] = updated;
        this.touch(stamp);
        return [{ type: "participant", characterId: op.characterId, participant: updated }];
      }
      case "seed": {
        if (!actor.gm) return { error: "forbidden" };
        if (!this.empty) return { error: "room not empty" };
        for (const combatant of op.combatants) {
          state.combatants[combatant.id] = { ...combatant, createdAt: stamp, updatedAt: stamp };
        }
        state.combat = op.combat;
        state.fog = { ...op.fog };
        this.touch(stamp);
        return [{ type: "state", state }];
      }
    }
  }

  private touch(stamp: string) {
    this.record.updatedAt = stamp;
  }
}
