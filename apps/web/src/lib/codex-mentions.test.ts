import { describe, expect, it } from "vitest";
import { codexKey, codexMentions } from "@adventure-keeper/schemas";

import { linkMentions, mentionResolver, mentions } from "@/lib/codex-mentions";

const resolve = mentionResolver(
  [
    { id: "g1", name: "Garrick" },
    { id: "a1", name: "Château d'Ashmoor" },
  ],
  (id) => `/campaigns/c/codex?entry=${id}`,
);

describe("linkMentions", () => {
  it("links the names the reader knows, ignoring case and accents", () => {
    expect(linkMentions("[[garrick]] fuit vers le [[chateau d'ashmoor]].", resolve)).toBe(
      "[garrick](/campaigns/c/codex?entry=g1) fuit vers le [chateau d'ashmoor](/campaigns/c/codex?entry=a1).",
    );
  });

  it("leaves an unknown name as plain text, so a hidden entry stays hidden", () => {
    expect(linkMentions("Le [[Roi-Liche]] attend.", resolve)).toBe("Le Roi-Liche attend.");
    expect(linkMentions("[[Garrick]]", () => null)).toBe("Garrick");
  });

  it("does not take single brackets or line breaks for mentions", () => {
    expect(linkMentions("[lien](https://x.y) et [[a\nb]]", resolve)).toBe(
      "[lien](https://x.y) et [[a\nb]]",
    );
  });
});

describe("mentions", () => {
  it("finds an entry mentioned in a recap", () => {
    expect(mentions("Puis [[GARRICK]] parla.", "Garrick")).toBe(true);
    expect(mentions("Garrick parla.", "Garrick")).toBe(false);
    expect(mentions(undefined, "Garrick")).toBe(false);
  });
});

describe("codexMentions / codexKey", () => {
  it("lists the mentions as written and keys them without accents", () => {
    expect(codexMentions("[[ Élise ]] et [[Bram]]")).toEqual(["Élise", "Bram"]);
    expect(codexKey(" Élise ")).toBe("elise");
  });
});
