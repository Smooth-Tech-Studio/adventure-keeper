import { describe, expect, it } from "vitest";

import { Room } from "./room";

const MEMBER = "member-key-0123456789";
const GM_KEY = "gm-key-0123456789abcdef";
const gm = { uid: "gm", gm: true };
const bob = { uid: "bob", gm: false };

const token = (id: string, kind: "participant" | "enemy" | "companion", playerId?: string) => ({
  id,
  sessionId: "s1",
  kind,
  refId: id,
  name: id,
  maxHitPoints: 10,
  currentHitPoints: 10,
  armorClass: 12,
  onMap: true,
  x: 0.5,
  y: 0.5,
  ...(playerId ? { playerId } : {}),
});

describe("Room", () => {
  it("admits the member key, and the GM with the GM key", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    expect(room.admit(MEMBER, undefined)).toEqual({ gm: false });
    expect(room.admit(MEMBER, GM_KEY)).toEqual({ gm: true });
    expect(room.admit(MEMBER, "wrong-gm-key-0123456789")).toEqual({ gm: false });
    expect(room.admit("wrong-member-key-012345", GM_KEY)).toBeNull();
    // Keys are kept hashed, never as they are.
    expect(JSON.stringify(room.record)).not.toContain(MEMBER);
  });

  it("lets the GM add anything, a player only their own familiar", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    expect(
      room.apply(gm, { type: "combatant.add", combatant: token("gob", "enemy") }),
    ).toHaveLength(1);
    expect(room.apply(bob, { type: "combatant.add", combatant: token("orc", "enemy") })).toEqual({
      error: "forbidden",
    });
    expect(
      room.apply(bob, { type: "combatant.add", combatant: token("owl", "companion", "bob") }),
    ).toHaveLength(1);
    expect(room.apply(bob, { type: "combatant.remove", id: "gob" })).toEqual({
      error: "forbidden",
    });
    expect(room.apply(bob, { type: "combatant.remove", id: "owl" })).toEqual([
      { type: "combatant.removed", id: "owl" },
    ]);
  });

  it("lets everyone move a token and play the turn order", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    room.apply(gm, { type: "combatant.add", combatant: token("thorin", "participant", "bob") });
    const moved = room.apply(bob, {
      type: "combatant.update",
      id: "thorin",
      patch: { x: 0.2, currentHitPoints: 7 },
    });
    expect(moved).toMatchObject([
      { type: "combatant", combatant: { x: 0.2, currentHitPoints: 7 } },
    ]);
    room.apply(bob, { type: "combat.set", combat: { round: 1, turnIndex: 1, order: ["thorin"] } });
    expect(room.state.combat?.turnIndex).toBe(1);
  });

  it("seeds an empty room once, for the GM only", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    const seed = { type: "seed" as const, combatants: [token("gob", "enemy")], combat: null };
    expect(room.apply(bob, seed)).toEqual({ error: "forbidden" });
    expect(room.apply(gm, seed)).toHaveLength(1);
    expect(room.empty).toBe(false);
    expect(room.apply(gm, seed)).toEqual({ error: "room not empty" });
  });

  it("keeps the fog the GM paints, and only the GM's", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    const fog = { mask: "AAE=", cols: 4, rows: 4 };
    expect(room.apply(bob, { type: "fog.set", locationId: "crypt", fog })).toEqual({
      error: "forbidden",
    });
    expect(room.apply(gm, { type: "fog.set", locationId: "crypt", fog })).toEqual([
      { type: "fog", locationId: "crypt", fog },
    ]);
    expect(room.state.fog).toEqual({ crypt: fog });
    // A painted room is no longer empty: no seed over it.
    expect(room.empty).toBe(false);
    expect(room.apply(gm, { type: "seed", combatants: [], combat: null })).toEqual({
      error: "room not empty",
    });
  });

  it("keeps the characters' play state: the GM tracks them, each player plays their own", () => {
    const room = Room.create("s1", MEMBER, GM_KEY);
    const thorin = { playerId: "bob", currentHitPoints: 12, spellSlotsUsed: { "1": 1 } };
    const track = {
      type: "participant.track" as const,
      characterId: "thorin",
      participant: thorin,
    };
    expect(room.apply(bob, track)).toEqual({ error: "forbidden" });
    expect(room.apply(gm, track)).toEqual([
      { type: "participant", characterId: "thorin", participant: thorin },
    ]);
    // Tracked again (another GM tab, a reload): the room is ahead, it stays.
    room.apply(bob, {
      type: "participant.update",
      characterId: "thorin",
      patch: { currentHitPoints: 9 },
    });
    expect(room.apply(gm, track)).toEqual([]);
    expect(room.state.participants?.thorin?.currentHitPoints).toBe(9);

    // Bob plays his own character, not the conditions the GM sets, nor Mira.
    expect(
      room.apply(bob, {
        type: "participant.update",
        characterId: "thorin",
        patch: { temporaryHitPoints: 5, concentration: null },
      }),
    ).toMatchObject([
      { participant: { temporaryHitPoints: 5, concentration: null, playerId: "bob" } },
    ]);
    expect(
      room.apply(bob, {
        type: "participant.update",
        characterId: "thorin",
        patch: { conditions: ["a-terre"] },
      }),
    ).toEqual({ error: "forbidden" });
    room.apply(gm, {
      type: "participant.track",
      characterId: "mira",
      participant: { playerId: "carol", currentHitPoints: 8 },
    });
    expect(
      room.apply(bob, {
        type: "participant.update",
        characterId: "mira",
        patch: { currentHitPoints: 0 },
      }),
    ).toEqual({ error: "forbidden" });
    expect(
      room.apply(gm, { type: "participant.update", characterId: "mira", patch: { exhaustion: 1 } }),
    ).toHaveLength(1);
    expect(
      room.apply(gm, {
        type: "participant.update",
        characterId: "nobody",
        patch: { exhaustion: 1 },
      }),
    ).toEqual({ error: "no such participant" });

    // The participants do not make a room « not empty »: the GM still seeds it.
    expect(room.empty).toBe(true);
  });

  it("reads a room saved before the fog", () => {
    const { record } = Room.create("s1", MEMBER, GM_KEY);
    const old = { ...record, state: { combatants: {}, combat: null } } as unknown as typeof record;
    expect(new Room(old).state.fog).toEqual({});
    expect(new Room(old).state.participants).toEqual({});
  });
});
