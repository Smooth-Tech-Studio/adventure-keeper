import { describe, expect, it } from "vitest";

import { featureUsesText } from "@/systems/dnd2024/lib/feature-uses";

describe("featureUsesText", () => {
  it("counts the uses at the character's level", () => {
    expect(featureUsesText({ max: 2, recharge: "long" }, 1)).toBe("2 fois par repos long");
    expect(featureUsesText({ max: "prof", recharge: "long" }, 5)).toBe(
      "3 fois (votre bonus de maîtrise) par repos long",
    );
    expect(featureUsesText({ max: { perLevel: 5 }, recharge: "long" }, 3)).toBe(
      "15 fois (5 × votre niveau) par repos long",
    );
  });

  it("names the ability when its modifier is not known yet", () => {
    expect(
      featureUsesText({ max: { ability: "cha", min: 1 }, recharge: "long", shortFrom: 5 }, 1),
    ).toBe("Modificateur de Charisme (min. 1) par repos long, court dès le niv. 5");
  });

  it("tells when a count grows next", () => {
    const rage = {
      max: {
        byLevel: [
          [1, 2],
          [3, 3],
          [6, 4],
        ] as [number, number][],
      },
      recharge: "long" as const,
    };
    expect(featureUsesText(rage, 3)).toBe("3 fois par repos long · puis 4 au niv. 6");
  });
});
