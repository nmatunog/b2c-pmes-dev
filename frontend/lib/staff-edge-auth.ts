import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";
import { EDGE_CORS_HEADERS } from "@/lib/edge-cors";

export type StaffRoleJwt = "admin" | "superuser" | "treasurer" | "board_director" | "secretary";
export type StaffJwtPayload = { sub: string; role: StaffRoleJwt };

/** Map Postgres `StaffUser.role` enum label to the compact JWT `role` claim (same rules as `POST /auth/admin/login`). */
export function dbStaffRoleToJwtRole(dbRole: string): StaffRoleJwt {
  switch (String(dbRole || "").trim()) {
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

const enc = new TextEncoder();

function jwtSecret(): Uint8Array {
  const secret = String(process.env.ADMIN_JWT_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not configured");
  }
  return enc.encode(secret);
}

export async function signStaffToken(payload: StaffJwtPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret());
}

export async function verifyStaffToken(token: string): Promise<StaffJwtPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const role = payload?.role;
  const sub = payload?.sub;
  const allowed: StaffRoleJwt[] = ["superuser", "admin", "treasurer", "board_director", "secretary"];
  if (typeof role !== "string" || !allowed.includes(role as StaffRoleJwt) || typeof sub !== "string" || !sub.trim()) {
    throw new Error("Invalid staff token");
  }
  return { sub, role: role as StaffRoleJwt };
}

function extractBearerToken(request: Request): string | null {
  const authorization = String(request.headers.get("authorization") ?? "").trim();
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export async function requireStaff(request: Request): Promise<StaffJwtPayload> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new Error("Missing Bearer token — sign in via POST /auth/admin/login");
  }
  return verifyStaffToken(token);
}

export function unauthorized(message: string) {
  return NextResponse.json({ message, statusCode: 401 }, { status: 401, headers: EDGE_CORS_HEADERS });
}

export function forbidden(message: string, headers?: Record<string, string>) {
  return NextResponse.json({ message, statusCode: 403 }, { status: 403, headers });
}
