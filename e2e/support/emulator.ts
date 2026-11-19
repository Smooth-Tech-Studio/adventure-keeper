/**
 * Direct access to the local Firebase emulators, to set up what a test needs
 * without going through the UI. Never talks to a real project.
 */
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { AUTH_PORT, FIRESTORE_PORT, PROJECT_ID } from "./ports";

const AUTH_HOST = `127.0.0.1:${AUTH_PORT}`;
const FIRESTORE_HOST = `127.0.0.1:${FIRESTORE_PORT}`;

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

/** Password of every account a test makes. */
export const TEST_PASSWORD = "e2e-password";

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  displayName: string;
}

/** A unique address, so parallel tests never share an account. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@e2e.test`;
}

/** An account with its `users/{uid}` profile, as the sign-up page makes it. */
export async function createTestUser(displayName = "Testeur"): Promise<TestUser> {
  const email = uniqueEmail(displayName.toLowerCase().replace(/\W+/g, "-"));
  const record = await adminAuth.createUser({ email, password: TEST_PASSWORD, displayName });
  await adminDb.doc(`users/${record.uid}`).set({
    uid: record.uid,
    email,
    displayName,
    locale: "fr",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { uid: record.uid, email, password: TEST_PASSWORD, displayName };
}

interface OobCode {
  email: string;
  /** For an e-mail change: the address the link was sent to. */
  newEmail?: string;
  requestType: string;
  oobCode: string;
  oobLink: string;
}

/** The e-mails the Auth emulator « sent » (reset links, verifications…). */
export async function sentEmails(email: string): Promise<OobCode[]> {
  const response = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await response.json()) as { oobCodes: OobCode[] };
  return oobCodes.filter((code) => code.email === email || code.newEmail === email);
}

/** Empties both emulators: every run starts from a blank project. */
export async function wipeEmulators() {
  await Promise.all([
    fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" }),
    fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    ),
  ]);
}

/** Characters stored for an account. */
export async function charactersOf(uid: string) {
  const snapshot = await adminDb.collection("characters").where("ownerId", "==", uid).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Follows a reset link the way Firebase's hosted page would. */
export async function resetPassword(oobCode: string, newPassword: string) {
  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobCode, newPassword }),
    },
  );
  if (!response.ok) throw new Error(`resetPassword: ${response.status} ${await response.text()}`);
}

/**
 * Reads a document through the Firestore REST API as `user`, so the security
 * rules apply as they do to the browser. Resolves `{ status, fields }`; the
 * fields are the raw Firestore-typed values (empty on a denied read).
 */
export async function readDocAs(
  user: TestUser,
  docPath: string,
): Promise<{ status: number; fields: Record<string, unknown> }> {
  const signIn = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.password, returnSecureToken: true }),
    },
  );
  const { idToken } = (await signIn.json()) as { idToken: string };
  const response = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  const body = (await response.json()) as { fields?: Record<string, unknown> };
  return { status: response.status, fields: body.fields ?? {} };
}
