/**
 * Adventure Keeper Serveur's installers: the releases of the app's own
 * repository, published by .github/workflows/release-serveur-reusable.yml
 * under stable names, so `releases/latest/download/<name>` always gives the
 * latest one.
 */
export const DESKTOP_RELEASES_REPO = "Smooth-Tech-Studio/adventure-keeper";

/**
 * The staging site links to the pre-release of that tag (`serveur-staging`: the staging
 * installers, pointed at the staging Firebase project) instead of the latest
 * release. Set by the Hosting deployment (deploy-hosting-reusable.yml).
 */
const RELEASE_TAG = import.meta.env.VITE_DESKTOP_RELEASE_TAG;

export type DesktopPlatform =
  "windows" | "macos-arm64" | "macos-x64" | "linux-appimage" | "linux-deb";

export const DESKTOP_ASSETS: Record<DesktopPlatform, string> = {
  windows: "Adventure-Keeper-Serveur-windows-x64-setup.exe",
  "macos-arm64": "Adventure-Keeper-Serveur-macos-arm64.dmg",
  "macos-x64": "Adventure-Keeper-Serveur-macos-x64.dmg",
  "linux-appimage": "Adventure-Keeper-Serveur-linux-x64.AppImage",
  "linux-deb": "Adventure-Keeper-Serveur-linux-x64.deb",
};

export const desktopDownloadUrl = (platform: DesktopPlatform) =>
  `https://github.com/${DESKTOP_RELEASES_REPO}/releases/${
    RELEASE_TAG ? `download/${RELEASE_TAG}` : "latest/download"
  }/${DESKTOP_ASSETS[platform]}`;

export const DESKTOP_RELEASES_PAGE = `https://github.com/${DESKTOP_RELEASES_REPO}/releases/${
  RELEASE_TAG ? `tag/${RELEASE_TAG}` : "latest"
}`;

/**
 * The installer that fits this browser's system, or null (a phone, a
 * tablet). A Mac's chip cannot be read reliably: Apple Silicon by default,
 * the Intel build is offered next to it.
 */
export function guessDesktopPlatform(userAgent = navigator.userAgent): DesktopPlatform | null {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return null;
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos-arm64";
  if (/Linux|X11/i.test(userAgent)) return "linux-appimage";
  return null;
}
