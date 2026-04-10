import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const COLLECTION = "pmes_progress";

/** @param {import('firebase/firestore').Firestore} db */
export function progressDocRef(db, appId, uid) {
  return doc(db, "artifacts", appId, "public", "data", COLLECTION, uid);
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadPmesProgress(db, appId, uid) {
  const snap = await getDoc(progressDocRef(db, appId, uid));
  if (!snap.exists()) return null;
  return snap.data() ?? null;
}

/**
 * Persists PMES UI state for resume-after-login. Omits undefined values for Firestore.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} appId
 * @param {string} uid
 * @param {Record<string, unknown>} payload
 */
export async function savePmesProgress(db, appId, uid, payload) {
  const cleaned = JSON.parse(JSON.stringify(payload));
  await setDoc(
    progressDocRef(db, appId, uid),
    {
      ...cleaned,
      userId: uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Clears saved progress (e.g. after member completes onboarding).
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} appId
 * @param {string} uid
 */
export async function clearPmesProgress(db, appId, uid) {
  await deleteDoc(progressDocRef(db, appId, uid));
}
