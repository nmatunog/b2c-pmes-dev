import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { syncMemberToPostgres } from "./memberSyncService.js";

/**
 * Canonical post-signup sequence (matches `App.jsx` registration): refresh ID token, set display name,
 * then upsert `Participant` in Neon via `POST …/auth/sync-member` with Bearer token.
 *
 * Use for optional inline marketing UIs. Full onboarding (consent, PMES, etc.) still lives in `App.jsx`.
 *
 * @param {import("firebase/auth").Auth} auth
 * @param {{ email: string; password: string; fullName: string }} fields
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function signupWithEmailPasswordAndNeonSync(auth, { email, password, fullName }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await cred.user.getIdToken(true);
  await updateProfile(cred.user, { displayName: fullName || "" }).catch(() => null);
  const base = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (base) {
    void syncMemberToPostgres(cred.user, fullName?.trim());
  }
  return cred;
}
