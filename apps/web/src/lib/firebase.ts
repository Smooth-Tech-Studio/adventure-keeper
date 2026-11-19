import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  // Don't throw: the UI should still render so the developer sees the message.
  console.error(
    `[firebase] Missing config for: ${missing.join(", ")}.\n` +
      "Copy apps/web/.env.example to apps/web/.env.local and fill in the values " +
      "(see docs/DEPLOYMENT.md).",
  );
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// `ignoreUndefinedProperties` lets us pass objects with optional fields left as
// `undefined` straight to `setDoc` / `addDoc` without stripping them by hand.
let firestore: Firestore;
try {
  firestore = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
} catch {
  // Already initialised (e.g. Vite HMR re-run this module).
  firestore = getFirestore(firebaseApp);
}
export const db = firestore;

if (import.meta.env.VITE_FIREBASE_USE_EMULATORS === "true") {
  // The end-to-end tests run their own emulators on other ports (playwright.config.ts).
  const authPort = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? "9099";
  const firestorePort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080);
  // The emulators run on the machine serving the page: a phone on the local
  // network opening http://192.168.x.x:5173 reaches them at that address too.
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
}
