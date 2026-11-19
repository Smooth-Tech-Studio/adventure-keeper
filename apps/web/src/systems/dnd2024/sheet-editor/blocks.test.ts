import { describe, expect, it } from "vitest";

import { emptyState, type FormState } from "@/systems/dnd2024/character-form/state";
import { modifiedBlocks } from "@/systems/dnd2024/sheet-editor/blocks";

describe("modifiedBlocks", () => {
  it("counts a corrected hit-point roll as a change to the abilities panel", () => {
    const saved: FormState = { ...emptyState(), classId: "fighter", level: 3 };
    const draft: FormState = { ...saved, hitPointRolls: [{ level: 2, roll: 7 }] };
    expect([...modifiedBlocks(saved, draft)]).toEqual(["abilities"]);
    expect(modifiedBlocks(saved, saved).size).toBe(0);
  });
});
