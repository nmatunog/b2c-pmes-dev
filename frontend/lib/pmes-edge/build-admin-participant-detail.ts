import { getSql } from "@/lib/db";
import { toLifecyclePayload } from "@/lib/pmes-edge/admin-lifecycle";
import { selectParticipantDetailRow } from "@/lib/pmes-edge/admin-participant-queries";
import { staffPositionLabel } from "@/lib/pmes-edge/staff-position-label";

/** Shared JSON shape for GET /api/pmes/admin/participants/:id and PATCH .../profile response. */
export async function buildAdminParticipantDetailJson(participantId: string) {
  const sql = getSql();
  const row = await selectParticipantDetailRow(sql, participantId);
  if (!row) return null;

  const loiRows = (await sql`
    SELECT id, address, occupation, employer, "initialCapital", "submittedAt"
    FROM "LoiSubmission"
    WHERE "participantId" = ${participantId}
    LIMIT 1
  `) as Array<{
    id: string;
    address: string;
    occupation: string;
    employer: string;
    initialCapital: number;
    submittedAt: string;
  }>;

  const pmesRows = (await sql`
    SELECT id, score, passed, timestamp
    FROM "PmesRecord"
    WHERE "participantId" = ${participantId}
    ORDER BY timestamp DESC
    LIMIT 12
  `) as Array<{ id: string; score: number; passed: boolean; timestamp: string }>;

  const staffRows = (await sql`
    SELECT role FROM "StaffUser" WHERE LOWER(TRIM(email)) = LOWER(TRIM(${row.email})) LIMIT 1
  `) as Array<{ role: string }>;
  const staffRole = staffRows[0]?.role ?? null;

  const createdRaw = (row as { createdAt?: string | Date }).createdAt;
  const createdAt =
    createdRaw instanceof Date ? createdRaw.toISOString() : String(createdRaw ?? "");

  return {
    registry: {
      participantId: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      dob: row.dob,
      gender: row.gender,
      legacyPioneerImport: Boolean(row.legacyPioneerImport),
      mailingAddress: row.mailingAddress ?? null,
      civilStatus: row.civilStatus ?? null,
      tinNo: row.tinNo ?? null,
      memberIdNo: row.memberIdNo,
      firebaseUid: row.firebaseUid ?? null,
      loiAddress: loiRows[0]?.address ?? null,
      fullProfileCompletedAt: row.fullProfileCompletedAt,
      createdAt,
      staffRole,
      staffPosition: staffPositionLabel(staffRole),
    },
    lifecycle: toLifecyclePayload(row),
    registryImportSnapshot: row.registryImportSnapshot ?? null,
    loiSubmission: loiRows[0] ?? null,
    memberProfileSnapshot: row.memberProfileSnapshot ?? null,
    fullProfileMeta: null,
    pmesRecords: pmesRows,
  };
}
