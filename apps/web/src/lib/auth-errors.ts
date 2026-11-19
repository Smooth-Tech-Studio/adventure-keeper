import { FirebaseError } from "firebase/app";

import i18n from "@/i18n";

/** Turn a Firebase Auth error into a short, user-facing message, in the interface language. */
export function authErrorMessage(error: unknown): string {
  const t = i18n.getFixedT(null, "auth", "errors");
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return t("invalidCredential");
      case "auth/email-already-in-use":
        return t("emailInUse");
      case "auth/invalid-email":
        return t("invalidEmail");
      case "auth/weak-password":
        return t("weakPassword");
      case "auth/too-many-requests":
        return t("tooManyRequests");
      case "auth/network-request-failed":
        return t("network");
      case "auth/requires-recent-login":
        return t("recentLogin");
      case "auth/missing-password":
        return t("missingPassword");
      case "auth/operation-not-allowed":
        return t("notAllowed");
      default:
        return t("generic");
    }
  }
  return t("unexpected");
}
