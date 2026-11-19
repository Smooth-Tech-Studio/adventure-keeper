import { describe, expect, it } from "vitest";
import { memberCharacterIds, type Adventure } from "@adventure-keeper/schemas";

import { adventureInProgress, holdingAdventure } from "@/lib/character-lock";
import type { WithId } from "@/lib/collections";

const adventure = (status: Adventure["status"], liveSessionId?: string) =>
  ({ id: status, title: status, status, liveSessionId }) as WithId<Adventure>;

describe("memberCharacterIds", () => {
  it("reads a member written before rosters as a roster of one", () => {
    expect(memberCharacterIds({ characterId: "a" })).toEqual(["a"]);
    expect(memberCharacterIds({})).toEqual([]);
  });

  it("puts the active character first", () => {
    expect(memberCharacterIds({ characterId: "b", characterIds: ["a", "b", "c"] })).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("holdingAdventure", () => {
  it("counts an adventure as in progress once active, or while a session is live", () => {
    expect(adventureInProgress(adventure("active"))).toBe(true);
    expect(adventureInProgress(adventure("upcoming", "session-1"))).toBe(true);
    expect(adventureInProgress(adventure("upcoming"))).toBe(false);
    expect(adventureInProgress(adventure("completed"))).toBe(false);
  });

  it("holds a character in an adventure in progress, unless it died there", () => {
    const active = adventure("active");
    expect(holdingAdventure([{ adventure: active, participant: {} as never }])).toBe(active);
    expect(
      holdingAdventure([
        { adventure: active, participant: { deathSaves: { successes: 0, failures: 3 } } as never },
      ]),
    ).toBeNull();
    expect(
      holdingAdventure([{ adventure: adventure("upcoming"), participant: {} as never }]),
    ).toBeNull();
  });
});
