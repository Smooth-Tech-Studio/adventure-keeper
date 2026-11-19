import { describe, expect, it } from "vitest";
import { parseContentPack } from "../packs/parse";
import { SRD_PACK } from "./pack";

describe("the SRD base pack", () => {
  it("is a pack like any other: the import accepts it", () => {
    const result = parseContentPack(SRD_PACK);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
