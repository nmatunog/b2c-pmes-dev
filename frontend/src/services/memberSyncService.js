/**
 * After Firebase sign-in, upsert the member row in Postgres via Nest (Neon).
 * Uses ID token auth — never send MEMBER_SYNC_SECRET from the browser.
 */

function apiBase() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
}

const REFERRAL_SESSION_KEY = "b2c_pmes_referral_code";

function readStoredReferralCode() {
  try {
    return sessionStorage.getItem(REFERRAL_SESSION_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function clearStoredReferralCode() {
  try {
    sessionStorage.removeItem(REFERRAL_SESSION_KEY);
  } catch {
    /* noop */
  }
}

/**
 * @param {import("firebase/auth").User} user
 * @param {string} [fullName] — preferred when known (e.g. right after sign-up form)
 */
export async function syncMemberToPostgres(user, fullName) {
  const base = apiBase();
  if (!base || !user?.uid || !user.email) return null;

  /** Force refresh so Nest verifies a current token (avoids stale-session 401s when Admin is configured). */
  const idToken = await user.getIdToken(true);
  const referralCode = readStoredReferralCode();
  const body = {
    uid: user.uid,
    email: user.email,
    ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
    ...(referralCode ? { referralCode } : {}),
  };

  const res = await fetch(`${base}/auth/sync-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (import.meta.env.DEV) {
      console.warn("[memberSync]", res.status, data);
      if (res.status === 401) {
        console.warn(
          "[memberSync] 401: Nest requires a valid Firebase ID token (same project as FIREBASE_* in backend/.env) or matching MEMBER_SYNC_SECRET. Fix backend env or leave MEMBER_SYNC_SECRET unset for local open sync.",
        );
      }
    }
    return null;
  }
  clearStoredReferralCode();
  return data;
}
