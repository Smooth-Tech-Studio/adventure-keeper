import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

/** Google's keys for Firebase ID tokens. */
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export interface AuthOptions {
  /** The Firebase project the app uses: only its users may join. */
  projectId?: string;
  /**
   * The Auth **emulator**'s tokens are not signed: accept them as they are.
   * Development and tests only — never on a public server.
   */
  emulator?: boolean;
}

/** The uid behind a Firebase ID token, or an error when it does not hold. */
export async function verifyFirebaseToken(token: string, options: AuthOptions): Promise<string> {
  if (options.emulator) {
    const claims = decodeJwt(token);
    const uid = (claims.user_id as string | undefined) ?? claims.sub;
    if (!uid) throw new Error("token without uid");
    if (options.projectId && claims.aud !== options.projectId) throw new Error("wrong project");
    return uid;
  }
  if (!options.projectId) throw new Error("FIREBASE_PROJECT_ID is not set");
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${options.projectId}`,
    audience: options.projectId,
  });
  if (!payload.sub) throw new Error("token without uid");
  return payload.sub;
}
