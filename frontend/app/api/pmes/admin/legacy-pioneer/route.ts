import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, forbidden, unauthorized } from "@/lib/staff-edge-auth";
import { insertLegacyPioneerRow } from "@/lib/pmes-edge/legacy-pioneer-insert.edge";

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff(request);
    if (staff.role !== "superuser") {
      return forbidden("Only a superuser can add legacy pioneer members.", EDGE_CORS_HEADERS);
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "JSON body required", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    const sql = getSql();
    const result = await insertLegacyPioneerRow(sql, body as Parameters<typeof insertLegacyPioneerRow>[1]);
    if (!result.ok) {
      return NextResponse.json(
        { message: `Could not create legacy member (${result.email}): ${result.reason}.`, statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        email: result.email,
        message:
          "Member can use Pioneer roster — link your account with the same full name + TIN stored here. Sign-in email is returned by eligibility check.",
      },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
