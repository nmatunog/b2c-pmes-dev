import { getApproximateAreaFromDevice } from "./deviceActivityArea.js";

export const SIGNUP_LIVE_ACTIVITY_KEY = "b2c_signup_live_activity";

/**
 * After a successful Firebase signup, resolve approximate device location and stash a payload
 * for the marketing landing page to show a personalized “live activity” line (session-only).
 * Writes `pending: true` immediately, then updates when geolocation + reverse geocode finish.
 */
export function queueSignupLiveActivityFromDevice() {
  try {
    sessionStorage.setItem(
      SIGNUP_LIVE_ACTIVITY_KEY,
      JSON.stringify({
        at: Date.now(),
        source: "signup",
        pending: true,
        area: null,
      }),
    );
  } catch {
    /* storage full / private mode */
  }
  (async () => {
    let area = null;
    try {
      area = await getApproximateAreaFromDevice();
    } catch {
      area = null;
    }
    try {
      sessionStorage.setItem(
        SIGNUP_LIVE_ACTIVITY_KEY,
        JSON.stringify({
          at: Date.now(),
          source: "signup",
          pending: false,
          area,
        }),
      );
    } catch {
      /* noop */
    }
  })();
}
