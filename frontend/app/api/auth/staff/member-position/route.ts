import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, forbidden, unauthorized } from "@/lib/staff-edge-auth";

const ALLOWED = new Set([
  "ADMIN",
  "TREASURER",
  "BOARD_DIRECTOR",
  "SECRETARY",
  "CHAIRMAN",
  "VICE_CHAIRMAN",
  "GENERAL_MANAGER",
]);

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function PATCH(request: Request) {
  let staff;
  try {
    staff = await requireStaff(request);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
  if (staff.role !== "superuser") {
    return forbidden("Only a superuser can change staff positions.", EDGE_CORS_HEADERS);
  }

  try {
    const body = (await request.json().catch(() => null)) as { memberEmail?: string; role?: string } | null;
    const memberEmail = String(body?.memberEmail ?? "")
      .trim()
      .toLowerCase();
    const role = String(body?.role ?? "").trim();
    if (!memberEmail || !role) {
      return NextResponse.json(
        { message: "memberEmail and role are required", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }
    if (!ALLOWED.has(role)) {
      return NextResponse.json(
        {
          message:
            "Choose ADMIN, TREASURER, SECRETARY, BOARD_DIRECTOR, CHAIRMAN (Chairperson), VICE_CHAIRMAN (Vice Chairperson), or GENERAL_MANAGER.",
          statusCode: 400,
        },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    const sql = getSql();
    const pRows = (await sql`
      SELECT id, "legacyPioneerImport", "firebaseUid", "registryImportSnapshot"
      FROM "Participant"
      WHERE LOWER(TRIM(email)) = ${memberEmail}
      LIMIT 1
    `) as Array<{
      id: string;
      legacyPioneerImport: boolean | null;
      firebaseUid: string | null;
      registryImportSnapshot: unknown;
    }>;
    const participant = pRows[0];
    if (!participant) {
      return NextResponse.json(
        { message: "No member record exists for that email.", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    const sRows = await sql`
      SELECT id, role FROM "StaffUser" WHERE LOWER(TRIM(email)) = ${memberEmail} LIMIT 1
    `;
    let s = (sRows as { id: string; role: string }[])[0];

    if (!s) {
      const noFirebaseLink =
        participant.firebaseUid == null ||
        (typeof participant.firebaseUid === "string" && participant.firebaseUid.trim() === "");
      const importedRosterRow =
        Boolean(participant.legacyPioneerImport) || participant.registryImportSnapshot != null;
      const legacyUnclaimed = noFirebaseLink && importedRosterRow;
      if (!legacyUnclaimed) {
        return NextResponse.json(
          {
            message:
              "No staff login exists for this email. Create an account in Admin accounts using the same email first.",
            statusCode: 400,
          },
          { status: 400, headers: EDGE_CORS_HEADERS },
        );
      }
      const passwordHash = await bcrypt.hash(`unclaimed-legacy-${crypto.randomUUID()}`, 12);
      const created = (await sql`
        INSERT INTO "StaffUser"(id, email, "passwordHash", role, "createdAt", "createdById")
        VALUES (gen_random_uuid()::text, ${memberEmail}, ${passwordHash}, ${role}::"StaffRole", NOW(), ${staff.sub})
        RETURNING id, email, role, "createdAt"
      `) as object[];
      return NextResponse.json((created as object[])[0] ?? { success: true }, { headers: EDGE_CORS_HEADERS });
    }

    if (s.role === "SUPERUSER") {
      return NextResponse.json(
        { message: "Cannot change role for a superuser account here.", statusCode: 400 },
        { status: 400, headers: EDGE_CORS_HEADERS },
      );
    }

    await sql`
      UPDATE "StaffUser"
      SET role = ${role}::"StaffRole"
      WHERE id = ${s.id}
    `;

    const out = await sql`
      SELECT id, email, role, "createdAt" FROM "StaffUser" WHERE id = ${s.id} LIMIT 1
    `;
    return NextResponse.json((out as object[])[0] ?? { success: true }, { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { message, statusCode: 500 },
      { status: 500, headers: EDGE_CORS_HEADERS },
    );
  }
}
