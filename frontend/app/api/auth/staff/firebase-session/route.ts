import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { verifyFirebaseIdToken } from "@/lib/firebase-edge";
import { dbStaffRoleToJwtRole, signStaffToken } from "@/lib/staff-edge-auth";

function extractBearer(request: Request): string | null {
  const v = String(request.headers.get("authorization") ?? "").trim();
  if (!v.toLowerCase().startsWith("bearer ")) return null;
  const t = v.slice(7).trim();
  return t || null;
}

export function OPTIONS() {
  return edgeCorsOptions();
}

/**
 * Issue a staff JWT when the caller proves Firebase identity and `StaffUser.email`
 * matches the token email (same DB row as password login, no password round-trip).
 */
export async function POST(request: Request) {
  const firebaseToken = extractBearer(request);
  if (!firebaseToken) {
    return NextResponse.json(
      { message: "Missing Authorization: Bearer <Firebase ID token>", statusCode: 401 },
      { status: 401, headers: EDGE_CORS_HEADERS },
    );
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  if (!projectId) {
    return NextResponse.json(
      { message: "FIREBASE_PROJECT_ID is not configured on API", statusCode: 503 },
      { status: 503, headers: EDGE_CORS_HEADERS },
    );
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(firebaseToken, projectId);
  } catch {
    return NextResponse.json(
      { message: "Invalid or expired Firebase ID token", statusCode: 401 },
      { status: 401, headers: EDGE_CORS_HEADERS },
    );
  }

  const rawEmail = typeof decoded.email === "string" ? decoded.email.trim() : "";
  if (!rawEmail) {
    return NextResponse.json(
      {
        message: "Your Google account has no email on this token; add an email to use staff tools.",
        statusCode: 400,
      },
      { status: 400, headers: EDGE_CORS_HEADERS },
    );
  }

  if (decoded.email_verified === false) {
    return NextResponse.json(
      {
        message: "Verify your Google email before opening the admin portal without a staff password.",
        statusCode: 403,
      },
      { status: 403, headers: EDGE_CORS_HEADERS },
    );
  }

  const norm = rawEmail.toLowerCase();

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, email, role FROM "StaffUser" WHERE LOWER(TRIM(email)) = ${norm} LIMIT 1
    `) as Array<{ id: string; email: string; role: string }>;
    const staff = rows[0];
    if (!staff) {
      return NextResponse.json(
        {
          message:
            "No cooperative staff account uses this Google email yet. Sign in with staff email and password, or ask a superuser to create one for this address.",
          statusCode: 404,
        },
        { status: 404, headers: EDGE_CORS_HEADERS },
      );
    }

    const role = dbStaffRoleToJwtRole(staff.role);
    const accessToken = await signStaffToken({ sub: staff.id, role });
    return NextResponse.json(
      {
        accessToken,
        expiresIn: "8h",
        role,
        dbRole: staff.role,
        email: String(staff.email).trim(),
      },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Staff session failed";
    return NextResponse.json({ message, statusCode: 500 }, { status: 500, headers: EDGE_CORS_HEADERS });
  }
}
