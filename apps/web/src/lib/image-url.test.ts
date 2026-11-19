import { describe, expect, it } from "vitest";
import { toDirectImageUrl } from "./image-url";

describe("toDirectImageUrl", () => {
  it("rewrites a Dropbox share link to a raw-image link", () => {
    const shared = "https://www.dropbox.com/scl/fi/abc123/image.png?rlkey=xyz&st=qwe&dl=0";
    const direct = new URL(toDirectImageUrl(shared));
    expect(direct.hostname).toBe("www.dropbox.com");
    expect(direct.searchParams.get("raw")).toBe("1");
    expect(direct.searchParams.has("dl")).toBe(false);
    expect(direct.searchParams.get("rlkey")).toBe("xyz");
  });

  it("turns a Google Drive file link into an embeddable thumbnail", () => {
    expect(toDirectImageUrl("https://drive.google.com/file/d/FILEID/view?usp=sharing")).toBe(
      "https://drive.google.com/thumbnail?id=FILEID&sz=w1000",
    );
  });

  it("leaves a plain image URL untouched", () => {
    expect(toDirectImageUrl("https://example.com/portrait.png")).toBe(
      "https://example.com/portrait.png",
    );
  });

  it("trims and passes through non-URL input", () => {
    expect(toDirectImageUrl("  not a url  ")).toBe("not a url");
    expect(toDirectImageUrl("")).toBe("");
  });
});
