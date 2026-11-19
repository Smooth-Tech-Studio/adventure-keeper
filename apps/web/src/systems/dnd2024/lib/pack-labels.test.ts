import { describe, expect, it } from "vitest";

import { packByline } from "@/systems/dnd2024/lib/pack-labels";

describe("packByline", () => {
  it("credits the author the file names, before where the pack comes from", () => {
    expect(packByline({ author: "Gandalf_42" }, "Partagé par Rémi")).toBe(
      "Créé par Gandalf_42 · partagé par Rémi",
    );
  });

  it("keeps only the source when the file names no author", () => {
    expect(packByline({}, "Votre pack")).toBe("Votre pack");
    expect(packByline({ author: "  " }, "Votre pack")).toBe("Votre pack");
  });
});
