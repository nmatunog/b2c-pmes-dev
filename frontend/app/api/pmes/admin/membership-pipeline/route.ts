import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, unauthorized } from "@/lib/staff-edge-auth";
import { toLifecyclePayload } from "@/lib/pmes-edge/admin-lifecycle";
import { selectMembershipPipelineRows } from "@/lib/pmes-edge/admin-participant-queries";

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function GET(request: Request) {
  try {
    await requireStaff(request);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
  try {
    const sql = getSql();
    const rows = await selectMembershipPipelineRows(sql);
    return NextResponse.json(
      rows.map((row) => ({
        ...toLifecyclePayload(row),
        fullName: row.fullName,
        phone: row.phone,
      })),
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pipeline query failed";
    console.error("[membership-pipeline]", message);
    return NextResponse.json(
      { message, statusCode: 500 },
      { status: 500, headers: EDGE_CORS_HEADERS },
    );
  }
}
