/**
 * @param {{
 *   useApi: boolean,
 *   apiLifecycle: Record<string, unknown> | null,
 *   pmesExamPassed: boolean,
 * }} opts
 * @returns {ResolvedAccess}
 */
export function resolveMemberPortalAccess({ useApi, apiLifecycle, pmesExamPassed }) {
  if (useApi && apiLifecycle && typeof apiLifecycle === "object") {
    const stage = String(apiLifecycle.stage || "UNKNOWN");
    const full = Boolean(apiLifecycle.canAccessFullMemberPortal);
    const pending =
      !full &&
      stage !== "NO_PARTICIPANT" &&
      stage !== "PMES_NOT_PASSED" &&
      stage !== "UNKNOWN";
    return {
      stage,
      canAccessFullMemberPortal: full,
      pendingMember: pending,
      ribbonStatus: full ? "full" : pmesExamPassed ? "pending" : "prospect",
    };
  }
  /** Firebase-only / no DB: keep prior open access; no cooperative pipeline enforcement */
  return {
    stage: "LEGACY_OPEN",
    canAccessFullMemberPortal: true,
    pendingMember: false,
    ribbonStatus: pmesExamPassed ? "full" : "prospect",
  };
}
