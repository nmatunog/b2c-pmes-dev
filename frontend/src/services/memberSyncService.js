/**
 * After Firebase sign-in, upsert the member row in Postgres via Nest (Neon).
 * Uses ID token auth — never send MEMBER_SYNC_SECRET from the browser.
 */

function apiBase() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
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
  const body = {
    uid: user.uid,
    email: user.email,
    ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
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
  return data;
}
