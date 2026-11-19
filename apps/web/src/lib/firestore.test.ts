import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { parseDoc } from "./firestore";

/** Minimal stand-in for a Firestore `DocumentSnapshot`. */
function fakeSnapshot(id: string, data: unknown) {
  return {
    id,
    data: () => data,
    ref: { path: `things/${id}` },
  } as unknown as Parameters<typeof parseDoc>[1];
}

const schema = z.object({ id: z.string(), name: z.string() });

describe("parseDoc", () => {
  it("returns { id, ...data } when the payload is valid", () => {
    expect(parseDoc(schema, fakeSnapshot("a", { name: "ok" }))).toEqual({
      id: "a",
      name: "ok",
    });
  });

  it("returns the raw payload without throwing when the schema fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = parseDoc(schema, fakeSnapshot("b", { name: 42 }));
    expect(out).toEqual({ id: "b", name: 42 });
    warn.mockRestore();
  });

  it("tolerates a snapshot whose data() is undefined", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseDoc(schema, fakeSnapshot("c", undefined))).toEqual({ id: "c" });
    warn.mockRestore();
  });
});
