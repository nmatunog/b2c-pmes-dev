import { createEmptyMemberProfile } from "./memberFullProfileSchema.js";

const STORAGE_PREFIX = "b2c_member_profile_draft_v1";

/** @param {string} email */
export function memberProfileDraftKey(email) {
  const e = String(email ?? "").trim().toLowerCase();
  return e ? `${STORAGE_PREFIX}:${e}` : "";
}

/**
 * Deep-merge saved JSON onto the current schema so older drafts stay valid after schema adds fields.
 * @param {Record<string, unknown>} base
 * @param {unknown} patch
 */
function deepMergeProfile(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (typeof patch !== "object") return patch;
  if (Array.isArray(patch)) {
    if (!Array.isArray(base)) return patch;
    return patch.map((item, i) => {
      const b = base[i];
      if (typeof item === "object" && item !== null && !Array.isArray(item) && b && typeof b === "object" && !Array.isArray(b)) {
        return deepMergeProfile(/** @type {Record<string, unknown>} */ (b), item);
      }
      return item;
    });
  }
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pk = patch[k];
    const bk = base[k];
    if (
      k in base &&
      bk !== null &&
      typeof bk === "object" &&
      !Array.isArray(bk) &&
      pk !== null &&
      typeof pk === "object" &&
      !Array.isArray(pk)
    ) {
      out[k] = deepMergeProfile(/** @type {Record<string, unknown>} */ (bk), pk);
    } else {
      out[k] = pk;
    }
  }
  return out;
}

/**
 * @param {string} email
 * @returns {{ profile: ReturnType<typeof createEmptyMemberProfile>; savedAt: number | null } | null}
 */
export function loadMemberProfileDraft(email) {
  if (typeof window === "undefined") return null;
  const key = memberProfileDraftKey(email);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const profilePayload = parsed.profile ?? parsed;
    const merged = deepMergeProfile(createEmptyMemberProfile(), profilePayload);
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : null;
    return { profile: merged, savedAt };
  } catch {
    return null;
  }
}

/**
 * @param {string} email
 * @param {ReturnType<typeof createEmptyMemberProfile>} profile
 */
export function saveMemberProfileDraft(email, profile) {
  if (typeof window === "undefined") return { ok: false, imageStripped: false };
  const key = memberProfileDraftKey(email);
  if (!key) return { ok: false, imageStripped: false };

  const payloadBase = {
    savedAt: Date.now(),
    profile,
  };
  const tryWrite = (prof) => {
    localStorage.setItem(key, JSON.stringify({ savedAt: payloadBase.savedAt, profile: prof }));
  };

  try {
    tryWrite(profile);
    return { ok: true, imageStripped: false };
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? String(e.name) : "";
    const isQuota = name === "QuotaExceededError" || (e && typeof e === "object" && e.code === 22);
    if (!isQuota) return { ok: false, imageStripped: false };

    const sig = profile.signature?.memberSignatureImageDataUrl;
    if (typeof sig === "string" && sig.length > 0) {
      try {
        tryWrite({
          ...profile,
          signature: {
            ...profile.signature,
            memberSignatureImageDataUrl: "",
          },
        });
        return { ok: true, imageStripped: true };
      } catch {
        return { ok: false, imageStripped: true };
      }
    }
    return { ok: false, imageStripped: false };
  }
}

/** @param {string} email */
export function clearMemberProfileDraft(email) {
  if (typeof window === "undefined") return;
  const key = memberProfileDraftKey(email);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
