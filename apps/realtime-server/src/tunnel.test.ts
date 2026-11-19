import { describe, expect, it } from "vitest";

import { findTunnelUrl } from "./tunnel";

describe("findTunnelUrl", () => {
  it("reads the quick tunnel's address from cloudflared's banner", () => {
    const log = [
      "2026-11-09T10:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...",
      "2026-11-09T10:00:01Z INF +--------------------------------------------------------+",
      "2026-11-09T10:00:01Z INF |  https://brave-otter-lantern-quest.trycloudflare.com   |",
    ].join("\n");
    expect(findTunnelUrl(log)).toBe("https://brave-otter-lantern-quest.trycloudflare.com");
  });

  it("ignores the API host it talks to before the tunnel is up", () => {
    expect(findTunnelUrl("INF Requesting new quick Tunnel on trycloudflare.com...")).toBeNull();
    expect(
      findTunnelUrl(
        'ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel"',
      ),
    ).toBeNull();
  });
});
