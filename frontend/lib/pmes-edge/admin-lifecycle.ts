export type AdminLifecycleRow = {
  id: string;
  email: string;
  legacyPioneerImport: boolean | null;
  memberIdNo: string | null;
  callsign: string | null;
  lastNameKey: string | null;
  lastNameSeq: number | null;
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  pmesPassed: boolean;
  loiSubmitted: boolean;
  initialFeesPaidAt: string | null;
  boardApprovedAt: string | null;
  fullProfileCompletedAt: string | null;
};

function computeAlternatePublicHandle(input: {
  callsign: string | null;
  lastNameKey: string | null;
  lastNameSeq: number | null;
}): string | null {
  if (input.callsign?.trim()) return input.callsign.trim();
  if (input.lastNameKey?.trim() && Number.isFinite(input.lastNameSeq) && (input.lastNameSeq ?? 0) > 0) {
    return `${input.lastNameKey.trim()}-${input.lastNameSeq}`;
  }
  return null;
}

export function toLifecyclePayload(row: AdminLifecycleRow) {
  const fees = Boolean(row.initialFeesPaidAt);
  const board = Boolean(row.boardApprovedAt);
  const profile = Boolean(row.fullProfileCompletedAt);
  let stage:
    | "PMES_NOT_PASSED"
    | "AWAITING_LOI"
    | "AWAITING_PAYMENT"
    | "PENDING_BOARD"
    | "AWAITING_FULL_PROFILE"
    | "FULL_MEMBER";
  if (!row.pmesPassed) stage = "PMES_NOT_PASSED";
  else if (!row.loiSubmitted) stage = "AWAITING_LOI";
  else if (!fees) stage = "AWAITING_PAYMENT";
  else if (!board) stage = "PENDING_BOARD";
  else if (!profile) stage = "AWAITING_FULL_PROFILE";
  else stage = "FULL_MEMBER";
  return {
    participantId: row.id,
    email: row.email,
    stage,
    pmEsPassed: row.pmesPassed,
    loiSubmitted: row.loiSubmitted,
    initialFeesPaid: fees,
    boardApproved: board,
    fullProfileCompleted: profile,
    canAccessFullMemberPortal: stage === "FULL_MEMBER",
    isLegacyFounderImport: Boolean(row.legacyPioneerImport),
    memberIdNo: row.memberIdNo,
    callsign: row.callsign,
    alternatePublicHandle: computeAlternatePublicHandle({
      callsign: row.callsign,
      lastNameKey: row.lastNameKey,
      lastNameSeq: row.lastNameSeq,
    }),
    memberIdIsProvisional: !profile,
    registrationFullName: row.fullName,
    registrationDob: row.dob,
    registrationGender: row.gender,
    registrationPhone: row.phone,
  };
}
