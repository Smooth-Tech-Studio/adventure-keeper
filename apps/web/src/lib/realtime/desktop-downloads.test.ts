import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopDownloadUrl, guessDesktopPlatform } from "./desktop-downloads";

describe("guessDesktopPlatform", () => {
  it("picks the installer for the browser's system", () => {
    expect(
      guessDesktopPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe("windows");
    expect(
      guessDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"),
    ).toBe("macos-arm64");
    expect(guessDesktopPlatform("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101")).toBe(
      "linux-appimage",
    );
  });

  it("offers nothing to a phone or a tablet", () => {
    expect(
      guessDesktopPlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile"),
    ).toBeNull();
    expect(
      guessDesktopPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit"),
    ).toBeNull();
  });
});

describe("desktopDownloadUrl", () => {
  it("points at the latest release, under a stable name", () => {
    expect(desktopDownloadUrl("windows")).toBe(
      "https://github.com/Smooth-Tech-Studio/adventure-keeper/releases/latest/download/Adventure-Keeper-Serveur-windows-x64-setup.exe",
    );
  });
});

describe("on the staging site", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("points at the staging pre-release instead of the latest release", async () => {
    vi.stubEnv("VITE_DESKTOP_RELEASE_TAG", "serveur-staging");
    vi.resetModules();
    const staging = await import("./desktop-downloads");
    expect(staging.desktopDownloadUrl("windows")).toBe(
      "https://github.com/Smooth-Tech-Studio/adventure-keeper/releases/download/serveur-staging/Adventure-Keeper-Serveur-windows-x64-setup.exe",
    );
    expect(staging.DESKTOP_RELEASES_PAGE).toBe(
      "https://github.com/Smooth-Tech-Studio/adventure-keeper/releases/tag/serveur-staging",
    );
  });
});
