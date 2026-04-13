import { PmesService } from "./pmesService.js";

/**
 * Resolve a login string to the Firebase email used for email/password auth.
 * Supports full email, or callsign / member ID / alternate label via REST when the value has no "@".
 *
 * @param {string} raw
 * @param {"signin" | "forgot"} context
 * @returns {Promise<{ ok: true; email: string } | { ok: false; message: string }>}
 */
export async function resolveFirebaseLoginEmail(raw, context = "signin") {
  const v = String(raw ?? "").trim();
  if (!v) {
    return {
      ok: false,
      message:
        context === "forgot"
          ? "Enter your email, callsign, or alternate label above, then tap Forgot password again."
          : "Enter your email, callsign, or alternate label.",
    };
  }
  if (v.includes("@")) {
    return { ok: true, email: v.toLowerCase() };
  }
  const api = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!api) {
    return {
      ok: false,
      message:
        context === "forgot"
          ? "Configure VITE_API_BASE_URL to reset password using a callsign or label."
          : "To sign in with a callsign, member ID, or label, set VITE_API_BASE_URL to your API.",
    };
  }
  const resolved = await PmesService.resolveLoginEmail(v);
  if (!resolved?.email) {
    return {
      ok: false,
      message:
        context === "forgot"
          ? "No account found for that login."
          : "No account found for that login. Try your email, callsign, member ID, or alternate label (e.g. cruz-2).",
    };
  }
  return { ok: true, email: resolved.email };
}
