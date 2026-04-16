import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { forbidden, requireStaff, unauthorized } from "@/lib/staff-edge-auth";
import { toLifecyclePayload } from "@/lib/pmes-edge/admin-lifecycle";
import { isMissingMemberProfileStampColumnError } from "@/lib/pmes-edge/pg-stamp-fallback";
import { selectAdminLifecycleRowByParticipantId } from "@/lib/pmes-edge/admin-participant-queries";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request);
    if (!(await isSuperuser(staff.sub))) {
      return forbidden("Only a superuser can set member IDs");
    }
    const { id } = await context.params;
    const participantId = String(id ?? "").trim();
    const body = (await request.json().catch(() => null)) as { memberIdNo?: string } | null;
    const memberIdNo = String(body?.memberIdNo ?? "").trim();
    if (!participantId || !memberIdNo || /\s/.test(memberIdNo)) {
      return NextResponse.json({ message: "Valid memberIdNo is required", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
    }

    const sql = getSql();
    const clash = (await sql`
      SELECT id FROM "Participant"
      WHERE id != ${participantId} AND LOWER(TRIM(COALESCE("memberIdNo", ''))) = LOWER(${memberIdNo})
      LIMIT 1
    `) as Array<{ id: string }>;
    if (clash[0]) {
      return NextResponse.json(
        { message: "Another participant already uses this member ID.", statusCode: 409 },
        { status: 409, headers: EDGE_CORS_HEADERS },
      );
    }

    try {
      await sql`
        UPDATE "Participant"
        SET
          "memberIdNo" = ${memberIdNo},
          "memberProfileConcurrencyStamp" = "memberProfileConcurrencyStamp" + 1
        WHERE id = ${participantId}
      `;
    } catch (e) {
      if (!isMissingMemberProfileStampColumnError(e)) throw e;
      await sql`
        UPDATE "Participant"
        SET "memberIdNo" = ${memberIdNo}
        WHERE id = ${participantId}
      `;
    }

    const row = await selectAdminLifecycleRowByParticipantId(sql, participantId);
    if (!row) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }

    return NextResponse.json(
      { success: true, memberIdNo, lifecycle: toLifecyclePayload(row) },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
