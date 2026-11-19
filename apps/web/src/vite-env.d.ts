/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_USE_EMULATORS?: string;
  /** Dropbox app key for image import (docs/IMAGE_STORAGE.md); absent = no import. */
  readonly VITE_DROPBOX_APP_KEY?: string;
  /** Release tag of the server app's installers (`staging` on the staging site); absent = latest. */
  readonly VITE_DESKTOP_RELEASE_TAG?: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_PORT?: string;
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
