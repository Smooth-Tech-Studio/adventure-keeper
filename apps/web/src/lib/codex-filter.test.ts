import { describe, expect, it } from "vitest";

import { countCodexKinds, filterCodex, parseCodexFilter } from "@/lib/codex-filter";

const entries = [
  { name: "Garrick", kind: "npc" as const, revealed: true },
  { name: "Frère Osric", kind: "npc" as const, revealed: false },
  { name: "Val-Brume", kind: "place" as const, revealed: true },
  { name: "La Confrérie du Linceul", kind: "faction" as const, revealed: false },
];

describe("filterCodex", () => {
  it("filters on kind, visibility and an accent-less search", () => {
    const all = { search: "", kind: "all" as const, visibility: "all" as const };
    expect(filterCodex(entries, all)).toHaveLength(4);
    expect(filterCodex(entries, { ...all, kind: "npc" }).map((e) => e.name)).toEqual([
      "Garrick",
      "Frère Osric",
    ]);
    expect(filterCodex(entries, { ...all, visibility: "hidden" })).toHaveLength(2);
    expect(filterCodex(entries, { ...all, search: "frere" }).map((e) => e.name)).toEqual([
      "Frère Osric",
    ]);
  });
});

describe("countCodexKinds", () => {
  it("counts per kind with the search and visibility applied", () => {
    const counts = countCodexKinds(entries, { search: "", visibility: "revealed" });
    expect(counts).toMatchObject({ all: 2, npc: 1, place: 1, faction: 0, deity: 0 });
  });
});

describe("parseCodexFilter", () => {
  it("reads the URL and falls back to « all »", () => {
    expect(parseCodexFilter(new URLSearchParams("type=faction&shown=hidden"))).toEqual({
      kind: "faction",
      visibility: "hidden",
    });
    expect(parseCodexFilter(new URLSearchParams("type=dragon&shown=maybe"))).toEqual({
      kind: "all",
      visibility: "all",
    });
  });
});
