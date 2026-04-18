import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, unauthorized } from "@/lib/staff-edge-auth";

type AdminRecordRow = {
  id: string;
  score: number;
  passed: boolean;
  timestamp: string;
  participantId: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
};

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function GET(request: Request) {
  try {
    await requireStaff(request);
    const sql = getSql();
    const rows = (await sql`
      SELECT
        pr.id,
        pr.score,
        pr.passed,
        pr.timestamp,
        p.id AS "participantId",
        p."fullName",
        p.email,
        p.phone,
        p.dob,
        p.gender
      FROM "PmesRecord" pr
      INNER JOIN "Participant" p ON p.id = pr."participantId"
      WHERE NOT COALESCE(p."legacyPioneerImport", false)
      ORDER BY pr.timestamp DESC
    `) as AdminRecordRow[];
    return NextResponse.json(rows, { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
