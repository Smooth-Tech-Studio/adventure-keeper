import { describe, expect, it } from "vitest";

import {
  characterSchema,
  dnd2024CharacterDraftSchema,
  isCharacterDraft,
  isDnd2024Character,
  readyCharacterSchema,
  standardCharacterDraftSchema,
  type Character,
} from "./character";

const audit = { createdAt: new Date(), updatedAt: new Date() };

/** The least a draft can be: a system, an owner, and nothing else decided. */
const emptyDnd2024Draft = {
  ...audit,
  system: "dnd2024" as const,
  status: "draft" as const,
  ownerId: "u1",
  name: "",
};

describe("draft schemas", () => {
  it("accepts a draft with nothing filled in but the system", () => {
    expect(dnd2024CharacterDraftSchema.safeParse(emptyDnd2024Draft).success).toBe(true);
  });

  it("accepts an empty name, which a finished sheet refuses", () => {
    expect(
      standardCharacterDraftSchema.safeParse({
        ...audit,
        system: "standard",
        status: "draft",
        ownerId: "u1",
        name: "",
      }).success,
    ).toBe(true);
    // The same emptiness on a ready sheet is a validation failure.
    expect(
      readyCharacterSchema.safeParse({
        ...audit,
        system: "standard",
        status: "ready",
        ownerId: "u1",
        name: "",
        maxHitPoints: 10,
        inventory: [],
      }).success,
    ).toBe(false);
  });

  it("keeps partially-filled choices", () => {
    const parsed = dnd2024CharacterDraftSchema.safeParse({
      ...emptyDnd2024Draft,
      name: "Ysoril",
      classId: "bard",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.classId).toBe("bard");
      expect(parsed.data.speciesId).toBeUndefined();
      // The derived block cannot exist on a draft — it needs class + scores.
      expect("maxHitPoints" in parsed.data).toBe(false);
    }
  });

  it("takes a content-pack class, and refuses an unknown bare id", () => {
    const withClass = (classId: string) =>
      dnd2024CharacterDraftSchema.safeParse({ ...emptyDnd2024Draft, classId }).success;
    expect(withClass("brumes-du-nord:arpenteur")).toBe(true);
    expect(withClass("arpenteur")).toBe(false);
  });

  // Regression: `formStateToDraftInput` used to emit the ability scores only
  // when all six were present, so three-of-six were silently dropped — the very
  // loss a draft exists to prevent.
  it("keeps ability scores entered one by one", () => {
    const parsed = dnd2024CharacterDraftSchema.safeParse({
      ...emptyDnd2024Draft,
      baseAbilityScores: { str: 15, dex: 14 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.baseAbilityScores).toEqual({ str: 15, dex: 14 });
    }
  });

  it("still demands the six scores on a finished sheet", () => {
    const half = {
      ...audit,
      system: "dnd2024",
      status: "ready",
      ownerId: "u1",
      name: "Ysoril",
      speciesId: "human",
      classId: "bard",
      backgroundId: "artisan",
      alignment: "N",
      baseAbilityScores: { str: 15, dex: 14 },
      backgroundAbilityBonuses: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    };
    expect(readyCharacterSchema.safeParse(half).success).toBe(false);
  });

  it("refuses a draft whose system is not decided", () => {
    const { system: _system, ...noSystem } = emptyDnd2024Draft;
    expect(dnd2024CharacterDraftSchema.safeParse(noSystem).success).toBe(false);
  });
});

describe("characterSchema", () => {
  it("accepts both a draft and a finished sheet", () => {
    expect(characterSchema.safeParse(emptyDnd2024Draft).success).toBe(true);
    expect(
      characterSchema.safeParse({
        ...audit,
        system: "standard",
        status: "ready",
        ownerId: "u1",
        name: "Bo",
        maxHitPoints: 12,
        inventory: [],
      }).success,
    ).toBe(true);
  });

  it("reads a legacy doc with no status as ready", () => {
    // Docs predate the field; `parseDoc` returns raw data, so the app also
    // applies this default in code — see `withCharacterDefaults`.
    const parsed = characterSchema.safeParse({
      ...audit,
      system: "standard",
      ownerId: "u1",
      name: "Legacy",
      maxHitPoints: 8,
      inventory: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe("ready");
  });
});

describe("isCharacterDraft", () => {
  it("separates the two", () => {
    expect(isCharacterDraft({ status: "draft" })).toBe(true);
    expect(isCharacterDraft({ status: "ready" })).toBe(false);
  });

  it("treats a legacy doc with no status as playable", () => {
    expect(isCharacterDraft({})).toBe(false);
  });

  it("does not overlap with the system guard", () => {
    // `isDnd2024Character` answers "which rules", not "is it playable" — a
    // 5e draft satisfies it, which is why the draft check comes first.
    const draft = { system: "dnd2024", status: "draft" };
    expect(isDnd2024Character(draft)).toBe(true);
    expect(isCharacterDraft(draft)).toBe(true);
  });
});

describe("the union is exhaustive over status", () => {
  it("narrows a Character to exactly one side", () => {
    const rows: Character[] = [
      emptyDnd2024Draft,
      {
        ...audit,
        system: "standard",
        status: "ready",
        ownerId: "u1",
        name: "Bo",
        maxHitPoints: 12,
        inventory: [],
      },
    ];
    // The point of the discriminated union: this compiles only because every
    // member carries a `status`, so no branch can be forgotten.
    const kinds = rows.map((row) => (isCharacterDraft(row) ? "draft" : "ready"));
    expect(kinds).toEqual(["draft", "ready"]);
  });
});
