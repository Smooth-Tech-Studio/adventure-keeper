/**
 * The end-to-end stack runs on its own ports (see `firebase.e2e.json`), so it
 * never mixes with `pnpm dev` — or with another project's emulators.
 */
export const APP_PORT = 5183;
export const AUTH_PORT = 9399;
export const FIRESTORE_PORT = 8380;
export const PROJECT_ID = "adv-keeper";
/** The self-hosted realtime server (`apps/realtime-server`), for sessions played through it. */
export const REALTIME_PORT = 8797;
