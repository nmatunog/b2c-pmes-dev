import { RESUMABLE_APP_STATES } from "./pmesConstants.js";

/**
 * Intelligently classify PMES progress for landing CTAs and resume copy.
 * @param {{
 *   pmesPaused: boolean,
 *   lastFlowAppState: string | null,
 *   pmesExamPassed: boolean,
 * }} input
 */
export function derivePmesIntent({ pmesPaused, lastFlowAppState, pmesExamPassed }) {
  if (pmesExamPassed) {
    return {
      kind: "complete",
      label: "PMES completed",
      resumeRecommended: false,
    };
  }
  const inFlow =
    Boolean(lastFlowAppState && RESUMABLE_APP_STATES.has(lastFlowAppState)) ||
    (typeof lastFlowAppState === "string" && lastFlowAppState.length > 0);
  if (pmesPaused && inFlow) {
    return {
      kind: "paused",
      label: "PMES in progress (paused)",
      resumeRecommended: true,
    };
  }
  if (inFlow) {
    return {
      kind: "in_progress",
      label: "PMES in progress",
      resumeRecommended: true,
    };
  }
  return {
    kind: "not_started",
    label: "PMES not started",
    resumeRecommended: false,
  };
}
