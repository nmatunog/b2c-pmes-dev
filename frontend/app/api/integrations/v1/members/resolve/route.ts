import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";

export function OPTIONS() {
  return edgeCorsOptions();
}

function extractBearer(request: Request): string {
  return String(request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/** B2C-Store checkout — resolve guest email to Participant.id (Edge; mirrors Nest controller). */
export async function GET(request: Request) {
  const expected = String(process.env.STORE_INTEGRATION_SECRET ?? "").trim();
  if (!expected) {
    return NextResponse.json(
      { message: "Store integration is not configured (STORE_INTEGRATION_SECRET)", statusCode: 503 },
      { status: 503, headers: EDGE_CORS_HEADERS },
    );
  }

  const token = extractBearer(request);
  if (!token || token !== expected) {
    return NextResponse.json(
      { message: "Invalid store integration credentials", statusCode: 401 },
      { status: 401, headers: EDGE_CORS_HEADERS },
    );
  }

  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { message: "email query parameter is required", statusCode: 400 },
      { status: 400, headers: EDGE_CORS_HEADERS },
    );
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, "memberIdNo", "fullName"
      FROM "Participant"
      WHERE email = ${email}
      LIMIT 1
    `;
    const participant = rows[0] as
      | { id: string; email: string; memberIdNo: string | null; fullName: string | null }
      | undefined;

    if (!participant) {
      return NextResponse.json(
        { message: "Member not found", statusCode: 404 },
        { status: 404, headers: EDGE_CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        participantId: participant.id,
        memberIdNo: participant.memberIdNo,
        email: participant.email,
        fullName: participant.fullName,
      },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Member resolve failed";
    return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500, headers: EDGE_CORS_HEADERS });
  }
}
