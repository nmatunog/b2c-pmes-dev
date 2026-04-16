import { getSql } from "@/lib/db";
import { isMissingMemberProfileStampColumnError } from "@/lib/pmes-edge/pg-stamp-fallback";
import type { AdminLifecycleRow } from "@/lib/pmes-edge/admin-lifecycle";

type Sql = ReturnType<typeof getSql>;

type AdminLifecycleRowWithOptionalStamp = Omit<AdminLifecycleRow, "memberProfileConcurrencyStamp"> & {
  memberProfileConcurrencyStamp?: number;
};

function normalizeAdminRow(row: AdminLifecycleRowWithOptionalStamp): AdminLifecycleRow {
  return {
    ...row,
    memberProfileConcurrencyStamp: row.memberProfileConcurrencyStamp ?? 0,
  };
}

/** Pipeline list — tolerates DB without `memberProfileConcurrencyStamp` until migration. */
export async function selectMembershipPipelineRows(sql: Sql): Promise<AdminLifecycleRow[]> {
  try {
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p."memberProfileConcurrencyStamp",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      ORDER BY p."createdAt" DESC
    `) as AdminLifecycleRowWithOptionalStamp[];
    return rows.map((r) => normalizeAdminRow(r));
  } catch (e) {
    if (!isMissingMemberProfileStampColumnError(e)) throw e;
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      ORDER BY p."createdAt" DESC
    `) as AdminLifecycleRowWithOptionalStamp[];
    return rows.map((r) => normalizeAdminRow(r));
  }
}

/** Single participant lifecycle row (membership PATCH / superuser member-id response). */
export async function selectAdminLifecycleRowByParticipantId(
  sql: Sql,
  participantId: string,
): Promise<AdminLifecycleRow | null> {
  try {
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p."memberProfileConcurrencyStamp",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      WHERE p.id = ${participantId}
      LIMIT 1
    `) as AdminLifecycleRowWithOptionalStamp[];
    const row = rows[0];
    return row ? normalizeAdminRow(row) : null;
  } catch (e) {
    if (!isMissingMemberProfileStampColumnError(e)) throw e;
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      WHERE p.id = ${participantId}
      LIMIT 1
    `) as AdminLifecycleRowWithOptionalStamp[];
    const row = rows[0];
    return row ? normalizeAdminRow(row) : null;
  }
}

export type ParticipantDetailRow = AdminLifecycleRow & {
  fullProfileJson: string | null;
  memberProfileSnapshot: unknown | null;
  registryImportSnapshot: unknown | null;
};

type ParticipantDetailWithOptionalStamp = Omit<ParticipantDetailRow, "memberProfileConcurrencyStamp"> & {
  memberProfileConcurrencyStamp?: number;
};

function normalizeDetailRow(row: ParticipantDetailWithOptionalStamp): ParticipantDetailRow {
  return {
    ...row,
    memberProfileConcurrencyStamp: row.memberProfileConcurrencyStamp ?? 0,
  };
}

export async function selectParticipantDetailRow(
  sql: Sql,
  participantId: string,
): Promise<ParticipantDetailRow | null> {
  try {
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p."memberProfileConcurrencyStamp",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        p."fullProfileJson",
        p."memberProfileSnapshot",
        p."registryImportSnapshot",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      WHERE p.id = ${participantId}
      LIMIT 1
    `) as ParticipantDetailWithOptionalStamp[];
    const row = rows[0];
    return row ? normalizeDetailRow(row) : null;
  } catch (e) {
    if (!isMissingMemberProfileStampColumnError(e)) throw e;
    const rows = (await sql`
      SELECT
        p.id,
        p.email,
        p."legacyPioneerImport",
        p."memberIdNo",
        p.callsign,
        p."lastNameKey",
        p."lastNameSeq",
        p."fullName",
        p.dob,
        p.gender,
        p.phone,
        p."initialFeesPaidAt",
        p."boardApprovedAt",
        p."fullProfileCompletedAt",
        p."fullProfileJson",
        p."memberProfileSnapshot",
        p."registryImportSnapshot",
        EXISTS (
          SELECT 1 FROM "PmesRecord" pr
          WHERE pr."participantId" = p.id AND pr.passed = true
        ) AS "pmesPassed",
        EXISTS (
          SELECT 1 FROM "LoiSubmission" ls
          WHERE ls."participantId" = p.id
        ) AS "loiSubmitted"
      FROM "Participant" p
      WHERE p.id = ${participantId}
      LIMIT 1
    `) as ParticipantDetailWithOptionalStamp[];
    const row = rows[0];
    return row ? normalizeDetailRow(row) : null;
  }
}
