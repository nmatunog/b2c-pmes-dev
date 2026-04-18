/**
 * Single cooperative join path: PMES → LOI → Payment → BOD approval → Full profile → Verified portal.
 * All "Join us" / onboarding CTAs should use {@link planJoinNavigation}.
 */

/**
 * @param {{ stage?: string, canAccessFullMemberPortal?: boolean } | null} lifecycle
 * @returns {{ step: string, message: string, tone?: 'info' | 'success' | 'warning' } | null}
 */
export function getJoinPipelineBanner({ useApi, lifecycle, pmesExamPassed }) {
  if (!useApi || !lifecycle || typeof lifecycle.stage !== "string") {
    if (!pmesExamPassed) {
      return {
        step: "PMES",
        message: "Next step: complete PMES (privacy notice, seminar modules, and exam).",
        tone: "info",
      };
    }
    return {
      step: "LOI",
      message:
        "Next step: submit your Letter of Intent, then payment. Connect the API for treasury/Board tracking.",
      tone: "info",
    };
  }

  if (lifecycle.canAccessFullMemberPortal === true || lifecycle.stage === "FULL_MEMBER") {
    return {
      step: "VERIFIED",
      message: "You have full member portal access.",
      tone: "success",
    };
  }

  const st = lifecycle.stage;
  if (st === "AWAITING_LOI") {
    return { step: "LOI", message: "Next step: submit your Letter of Intent.", tone: "info" };
  }
  if (st === "AWAITING_PAYMENT") {
    return { step: "PAYMENT", message: "Next step: pay share capital and membership fee.", tone: "info" };
  }
  if (st === "AWAITING_BOD_VOTE") {
    return {
      step: "BOD",
      message: "Directors are voting on your application — we will notify you by email.",
      tone: "info",
    };
  }
  if (st === "AWAITING_SECRETARY_RESOLUTION") {
    return {
      step: "BOD",
      message: "Awaiting Secretary Board Resolution — then you can complete your membership form.",
      tone: "info",
    };
  }
  if (st === "AWAITING_FULL_PROFILE") {
    return {
      step: "PROFILE",
      message: "Next step: complete your official B2C membership form.",
      tone: "info",
    };
  }
  if (st === "PMES_NOT_PASSED" || st === "NO_PARTICIPANT") {
    if (pmesExamPassed) {
      return {
        step: "SYNC",
        message:
          "PMES is complete on this device — continue with membership steps below. If something looks out of date, refresh or contact the office.",
        tone: "warning",
      };
    }
    return {
      step: "PMES",
      message: "Next step: complete PMES (seminar modules and exam).",
      tone: "info",
    };
  }
  if (st === "UNKNOWN") {
    return { step: "UNKNOWN", message: "Could not load membership status — try again or contact support.", tone: "warning" };
  }
  return null;
}

/**
 * @returns {{ type: 'state', value: string } | { type: 'continue_pmes' } | { type: 'auth' }}
 */
export function planJoinNavigation({
  useApi,
  lifecycle,
  pmesExamPassed,
  resumePmesSuggested,
  isLoggedIn,
}) {
  if (!isLoggedIn) {
    return { type: "auth" };
  }

  if (useApi && lifecycle && typeof lifecycle.stage === "string") {
    const stage = lifecycle.stage;
    if (lifecycle.canAccessFullMemberPortal === true || stage === "FULL_MEMBER") {
      return { type: "state", value: "member_portal" };
    }
    if (stage === "AWAITING_FULL_PROFILE") {
      return { type: "state", value: "member_pending" };
    }
    if (stage === "AWAITING_BOD_VOTE" || stage === "AWAITING_SECRETARY_RESOLUTION") {
      return { type: "state", value: "member_pending" };
    }
    if (stage === "AWAITING_PAYMENT") {
      return { type: "state", value: "payment_portal" };
    }
    if (stage === "AWAITING_LOI") {
      return { type: "state", value: "loi_form" };
    }
    if (stage === "PMES_NOT_PASSED" || stage === "NO_PARTICIPANT") {
      if (pmesExamPassed) {
        return { type: "state", value: "member_pending" };
      }
      if (resumePmesSuggested) {
        return { type: "continue_pmes" };
      }
      return { type: "state", value: "consent" };
    }
    return { type: "state", value: "member_pending" };
  }

  if (!pmesExamPassed) {
    if (resumePmesSuggested) {
      return { type: "continue_pmes" };
    }
    return { type: "state", value: "consent" };
  }
  return { type: "state", value: "loi_form" };
}

/**
 * Hide "Start PMES" / PMES entry when PMES is already done or the pipeline has moved on.
 */
export function shouldHidePmesEntry({ useApi, lifecycle, pmesExamPassed }) {
  if (pmesExamPassed) return true;
  if (!useApi || !lifecycle?.stage) return false;
  const st = lifecycle.stage;
  return (
    st === "AWAITING_LOI" ||
    st === "AWAITING_PAYMENT" ||
    st === "AWAITING_BOD_VOTE" ||
    st === "AWAITING_SECRETARY_RESOLUTION" ||
    st === "AWAITING_FULL_PROFILE" ||
    st === "FULL_MEMBER" ||
    lifecycle.canAccessFullMemberPortal === true
  );
}
