import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { forbidden, requireStaff, unauthorized } from "@/lib/staff-edge-auth";
import { toLifecyclePayload } from "@/lib/pmes-edge/admin-lifecycle";
import { selectParticipantDetailRow } from "@/lib/pmes-edge/admin-participant-queries";

async function isSuperuser(staffId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    SELECT role
    FROM "StaffUser"
    WHERE id = ${staffId}
    LIMIT 1
  `) as Array<{ role: "ADMIN" | "SUPERUSER" }>;
  return rows[0]?.role === "SUPERUSER";
}

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(request);
    const { id } = await context.params;
    const participantId = String(id ?? "").trim();
    const sql = getSql();
    const row = await selectParticipantDetailRow(sql, participantId);
    if (!row) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }
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

    return NextResponse.json(
      {
        registry: {
          participantId: row.id,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          dob: row.dob,
          gender: row.gender,
          mailingAddress: null,
          civilStatus: null,
          memberIdNo: row.memberIdNo,
          loiAddress: loiRows[0]?.address ?? null,
          fullProfileCompletedAt: row.fullProfileCompletedAt,
        },
        lifecycle: toLifecyclePayload(row),
        registryImportSnapshot: row.registryImportSnapshot ?? null,
        loiSubmission: loiRows[0] ?? null,
        memberProfileSnapshot: row.memberProfileSnapshot ?? null,
        fullProfileMeta: null,
        pmesRecords: pmesRows,
      },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request);
    if (!(await isSuperuser(staff.sub))) {
      return forbidden("Only a superuser can delete participants");
    }
    const { id } = await context.params;
    const participantId = String(id ?? "").trim();
    if (!participantId) {
      return NextResponse.json({ message: "participant id is required", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
    }
    const sql = getSql();
    const hit = (await sql`SELECT id FROM "Participant" WHERE id = ${participantId} LIMIT 1`) as Array<{ id: string }>;
    if (!hit[0]) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }
    await sql`DELETE FROM "PmesRecord" WHERE "participantId" = ${participantId}`;
    await sql`DELETE FROM "LoiSubmission" WHERE "participantId" = ${participantId}`;
    await sql`DELETE FROM "Participant" WHERE id = ${participantId}`;
    return NextResponse.json({ deleted: true, participantId }, { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
