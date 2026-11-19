import { describe, expect, it } from "vitest";

import { combatantColor } from "@/lib/combatant-color";

describe("combatantColor", () => {
  it("keeps a token's own colour", () => {
    expect(combatantColor({ kind: "enemy", color: "#123456" })).toBe("#123456");
  });

  it("tells enemies, allies and the party apart", () => {
    expect(combatantColor({ kind: "enemy" })).toBe("#b91c1c");
    expect(combatantColor({ kind: "enemy", ally: true })).toBe("#0d9488");
    expect(combatantColor({ kind: "participant" })).toBe("#2563eb");
  });
});
