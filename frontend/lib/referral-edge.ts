import type { getSql } from "@/lib/db";

/** Matches `frontend/src/lib/referralTiers.js` PIONEER_POINTS_PER_JOIN */
export const REFERRAL_PIONEER_POINTS_PER_JOIN = 50;

type Sql = ReturnType<typeof getSql>;

export function startOfCurrentUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Resolves `PIONEER-xxxxxxxx` to a single referrer participant id (last 8 hex chars of Firebase uid).
 */
export async function resolveReferrerParticipantId(
  sql: Sql,
  referralCodeRaw: string | undefined,
  newFirebaseUid: string,
): Promise<string | null> {
  const raw = String(referralCodeRaw ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^PIONEER-([a-fA-F0-9]{8})$/i);
  if (!m?.[1]) return null;
  const suffix = m[1].toUpperCase();
  const rows = await sql`
    SELECT id, "firebaseUid" FROM "Participant"
    WHERE "firebaseUid" IS NOT NULL
    AND UPPER(RIGHT(REPLACE("firebaseUid", '-', ''), 8)) = ${suffix}
    LIMIT 2
  `;
  const list = rows as { id: string; firebaseUid: string | null }[];
  if (list.length !== 1) return null;
  const refUid = String(list[0]!.firebaseUid ?? "");
  if (!refUid || refUid === newFirebaseUid) return null;
  return list[0]!.id;
}

export async function fetchReferralRewards(sql: Sql, participantId: string) {
  const monthStart = startOfCurrentUtcMonth();
  const totalRows = await sql`
    SELECT COUNT(*)::int AS c FROM "Participant"
    WHERE "referredByParticipantId" = ${participantId}
      AND "referralJoinCreditedAt" IS NOT NULL
  `;
  const monthRows = await sql`
    SELECT COUNT(*)::int AS c FROM "Participant"
    WHERE "referredByParticipantId" = ${participantId}
      AND "referralJoinCreditedAt" IS NOT NULL
      AND "referralJoinCreditedAt" >= ${monthStart}
  `;
  const successfulJoinCount = Number((totalRows as { c: number }[])[0]?.c ?? 0);
  const invitesThisMonth = Number((monthRows as { c: number }[])[0]?.c ?? 0);
  return {
    successfulJoinCount,
    pioneerPoints: successfulJoinCount * REFERRAL_PIONEER_POINTS_PER_JOIN,
    invitesThisMonth,
  };
}

/**
 * After full profile submit: mark referral credit when referee is a full member with a referrer.
 */
export async function maybeCreditReferralJoin(sql: Sql, participantId: string): Promise<void> {
  const rows = await sql`
    SELECT
      p."referredByParticipantId",
      p."referralJoinCreditedAt",
      p."initialFeesPaidAt",
      p."boardApprovedAt",
      p."fullProfileCompletedAt",
      EXISTS (SELECT 1 FROM "PmesRecord" r WHERE r."participantId" = p.id AND r.passed = true) AS "pmesPassed",
      EXISTS (SELECT 1 FROM "LoiSubmission" l WHERE l."participantId" = p.id) AS "hasLoi"
    FROM "Participant" p
    WHERE p.id = ${participantId}
    LIMIT 1
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return;
  if (!row.referredByParticipantId || row.referralJoinCreditedAt) return;
  if (!row.pmesPassed || !row.hasLoi || !row.initialFeesPaidAt || !row.boardApprovedAt || !row.fullProfileCompletedAt) {
    return;
  }
  await sql`
    UPDATE "Participant"
    SET "referralJoinCreditedAt" = NOW()
    WHERE id = ${participantId}
      AND "referralJoinCreditedAt" IS NULL
  `;
}
