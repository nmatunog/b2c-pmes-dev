import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, unauthorized, forbidden } from "@/lib/staff-edge-auth";
import { toLifecyclePayload } from "@/lib/pmes-edge/admin-lifecycle";
import { selectAdminLifecycleRowByParticipantId } from "@/lib/pmes-edge/admin-participant-queries";

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireStaff(request);
    const body = (await request.json().catch(() => null)) as
      | { participantId?: string; initialFeesPaid?: boolean; boardApproved?: boolean }
      | null;
    const participantId = String(body?.participantId ?? "").trim();
    const initialFeesPaid = body?.initialFeesPaid === true;
    const boardApproved = body?.boardApproved === true;
    if (!participantId) {
      return NextResponse.json(
        { message: "participantId is required", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }
    if (!initialFeesPaid && !boardApproved) {
      return NextResponse.json(
        { message: "Set initialFeesPaid and/or boardApproved to true to record a step.", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    if (initialFeesPaid && !["superuser", "admin", "treasurer"].includes(staff.role)) {
      return forbidden("Only Treasurer (or Admin / Superuser) can confirm fee payment.", EDGE_CORS_HEADERS);
    }
    if (boardApproved && staff.role !== "superuser") {
      return forbidden(
        "Use Secretary confirmation to record Board approval with a resolution number. Superuser may override here for legacy support.",
        EDGE_CORS_HEADERS,
      );
    }

    const sql = getSql();
    await sql`
      UPDATE "Participant"
      SET
        "initialFeesPaidAt" = CASE WHEN ${initialFeesPaid} THEN NOW() ELSE "initialFeesPaidAt" END,
        "boardApprovedAt" = CASE WHEN ${boardApproved} THEN NOW() ELSE "boardApprovedAt" END
      WHERE id = ${participantId}
    `;

    const row = await selectAdminLifecycleRowByParticipantId(sql, participantId);
    if (!row) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }

    return NextResponse.json(toLifecyclePayload(row), { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
