import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, unauthorized } from "@/lib/staff-edge-auth";
import { toLifecyclePayload, type AdminLifecycleRow } from "@/lib/pmes-edge/admin-lifecycle";

type MembershipPipelineRow = AdminLifecycleRow;

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function GET(request: Request) {
  try {
    await requireStaff(request);
    const sql = getSql();
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
    `) as MembershipPipelineRow[];
    return NextResponse.json(
      rows.map((row) => ({
        ...toLifecyclePayload(row),
        fullName: row.fullName,
        phone: row.phone,
      })),
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
