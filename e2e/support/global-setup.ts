import { wipeEmulators } from "./emulator";
import { AUTH_PORT, FIRESTORE_PORT } from "./ports";

/** Playwright waits for Firestore only; Auth can come up a moment later. */
async function waitFor(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`${url} did not answer within ${timeoutMs / 1000} s`);
}

export default async function globalSetup() {
  await waitFor(`http://127.0.0.1:${AUTH_PORT}`);
  await waitFor(`http://127.0.0.1:${FIRESTORE_PORT}`);
  await wipeEmulators();
}
