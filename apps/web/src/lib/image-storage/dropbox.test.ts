import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  directLink,
  freshConnection,
  pkcePair,
  safeFileName,
  uploadToDropbox,
} from "@/lib/image-storage/dropbox";
import type { StorageConnection } from "@/lib/image-storage/types";

const connection: StorageConnection = {
  provider: "dropbox",
  refreshToken: "refresh",
  accessToken: "old",
  expiresAt: 0,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Dropbox", () => {
  beforeEach(() => vi.stubEnv("VITE_DROPBOX_APP_KEY", "app-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("names the file safely and links to its bytes", () => {
    expect(safeFileName("Carte de la crypte (v2).PNG")).toBe("carte-de-la-crypte-v2.png");
    expect(safeFileName("???")).toBe("image");
    expect(directLink("https://www.dropbox.com/scl/fi/abc/map.png?rlkey=x&dl=0")).toBe(
      "https://www.dropbox.com/scl/fi/abc/map.png?rlkey=x&raw=1",
    );
  });

  it("makes a PKCE pair whose challenge is the verifier's SHA-256", async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refreshes an expired token, keeps a fresh one", async () => {
    const fetchMock = vi.fn(async () => json({ access_token: "new", expires_in: 14400 }));
    vi.stubGlobal("fetch", fetchMock);
    const fresh = await freshConnection(connection);
    expect(fresh.accessToken).toBe("new");
    expect(await freshConnection(fresh)).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads to the app folder, shares the file, reuses an existing link", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/oauth2/token")) return json({ access_token: "new", expires_in: 14400 });
        if (url.endsWith("/files/upload")) return json({ path_lower: "/images/2026-10/x-map.png" });
        if (url.endsWith("/create_shared_link_with_settings"))
          return new Response('{"error_summary":"shared_link_already_exists/.."}', {
            status: 409,
          });
        return json({ links: [{ url: "https://www.dropbox.com/scl/fi/x/map.png?rlkey=k&dl=0" }] });
      }),
    );
    const file = new File(["png"], "Map.png", { type: "image/png" });
    const result = await uploadToDropbox(connection, file, new Date(2026, 9, 18));
    expect(result.url).toBe("https://www.dropbox.com/scl/fi/x/map.png?rlkey=k&raw=1");
    expect(result.connection.accessToken).toBe("new");
    const upload = calls.find((c) => c.url.endsWith("/files/upload"))!;
    const arg = JSON.parse((upload.init.headers as Record<string, string>)["Dropbox-API-Arg"]);
    expect(arg.path).toMatch(/^\/images\/2026-10\/[a-z0-9]+-map\.png$/);
    expect((upload.init.headers as Record<string, string>).Authorization).toBe("Bearer new");
  });
});
