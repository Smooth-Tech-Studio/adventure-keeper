import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

import {
  APP_PORT,
  AUTH_PORT,
  FIRESTORE_PORT,
  PROJECT_ID,
  REALTIME_PORT,
} from "./e2e/support/ports";

/**
 * End-to-end tests: the real front against Firebase emulators of its own.
 *
 *   pnpm test:e2e        # starts the emulators and Vite if they are not running
 *   pnpm test:e2e:ui     # same, in Playwright's UI mode
 *
 * The stack runs on dedicated ports (`firebase.e2e.json`, Vite on 5183), so it
 * never touches `pnpm dev` and its seed. The emulators are emptied before each
 * run, and each test makes its own accounts, so the tests run in parallel.
 *
 * The tests check that features are reachable and work — never pixels.
 */
const BASE_URL = `http://localhost:${APP_PORT}`;
/** Live-session scenarios (13, 14). */
const LIVE_SPECS = /1[3-8]-[\w-]+\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/explore/**",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // The creation wizard is a long journey; the rest is quick.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: LIVE_SPECS,
    },
    {
      // A live table is three browsers listening to each other in real time:
      // one at a time, or they starve each other (and the emulator).
      name: "live",
      use: { ...devices["Desktop Chrome"] },
      testMatch: LIVE_SPECS,
      workers: 1,
    },
  ],
  webServer: [
    {
      command: `firebase emulators:start --only auth,firestore --config firebase.e2e.json --project ${PROJECT_ID}`,
      // The Firestore emulator answers « Ok » on its root once it is up.
      url: `http://127.0.0.1:${FIRESTORE_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      // Lets the CLI stop its emulators: killed outright, it leaves the
      // Firestore JVM behind, holding the port for the next run.
      gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    },
    {
      // A build, not the dev server: each browser context would otherwise
      // fetch hundreds of modules, and a live table opens three of them.
      // `--mode development` keeps `.env.development` (the emulators).
      // The workspace packages are read from their `dist/`: built first (turbo
      // caches them), so a fresh checkout — the CI — works too.
      command:
        `pnpm turbo run build --filter=@adventure-keeper/web^... && ` +
        `pnpm --filter @adventure-keeper/web exec vite build --mode development --outDir dist-e2e` +
        ` && pnpm --filter @adventure-keeper/web exec vite preview --outDir dist-e2e --port ${APP_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        // Production React, whatever the mode.
        NODE_ENV: "production",
        VITE_FIREBASE_AUTH_EMULATOR_PORT: String(AUTH_PORT),
        VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: String(FIRESTORE_PORT),
      },
    },
    {
      // The realtime server, for the sessions started « avec un serveur ».
      // It takes the Auth emulator's unsigned tokens — never do that in production.
      command:
        `pnpm turbo run build --filter=@adventure-keeper/realtime-server && ` +
        `node apps/realtime-server/dist/server.js`,
      url: `http://127.0.0.1:${REALTIME_PORT}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        PORT: String(REALTIME_PORT),
        FIREBASE_AUTH_EMULATOR: "1",
        FIREBASE_PROJECT_ID: PROJECT_ID,
        DATA_DIR: path.join(os.tmpdir(), "adventure-keeper-e2e-rooms"),
      },
    },
  ],
});
