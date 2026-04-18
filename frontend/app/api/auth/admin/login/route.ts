import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { signStaffToken, type StaffRoleJwt } from "@/lib/staff-edge-auth";

type StaffRow = {
  id: string;
  email: string;
  role: string;
  passwordHash: string;
};

/** Chairman / Vice chairman / GM sign in with the same admin authorization as ADMIN (JWT role `admin`). */
function dbRoleToJwt(role: string): StaffRoleJwt {
  switch (role) {
    case "SUPERUSER":
      return "superuser";
    case "TREASURER":
      return "treasurer";
    case "BOARD_DIRECTOR":
      return "board_director";
    case "SECRETARY":
      return "secretary";
    case "CHAIRMAN":
    case "VICE_CHAIRMAN":
    case "GENERAL_MANAGER":
    case "ADMIN":
    default:
      return "admin";
  }
}

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || !password) {
      return NextResponse.json(
        { message: "Invalid email or password", statusCode: 401 },
        { status: 401, headers: EDGE_CORS_HEADERS },
      );
    }

    const sql = getSql();
    const rows = (await sql`
      SELECT id, email, role, "passwordHash"
      FROM "StaffUser"
      WHERE email = ${email}
      LIMIT 1
    `) as StaffRow[];
    const staff = rows[0];
    if (!staff) {
      return NextResponse.json(
        { message: "Invalid email or password", statusCode: 401 },
        { status: 401, headers: EDGE_CORS_HEADERS },
      );
    }

    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { message: "Invalid email or password", statusCode: 401 },
        { status: 401, headers: EDGE_CORS_HEADERS },
      );
    }

    const role = dbRoleToJwt(staff.role);
    const accessToken = await signStaffToken({ sub: staff.id, role });
    return NextResponse.json(
      { accessToken, expiresIn: "8h", role, dbRole: staff.role },
      { headers: EDGE_CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Staff sign-in failed";
    return NextResponse.json({ message, statusCode: 500 }, { status: 500, headers: EDGE_CORS_HEADERS });
  }
}
