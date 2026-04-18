import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import { requireStaff, unauthorized } from "@/lib/staff-edge-auth";
import { staffPositionLabel } from "@/lib/pmes-edge/staff-position-label";

type RegistryRow = {
  participantId: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  mailingAddress: string | null;
  civilStatus: string | null;
  memberIdNo: string | null;
  loiAddress: string | null;
  fullProfileCompletedAt: string | null;
  createdAt: string;
  legacyPioneerImport: boolean;
  firebaseUid: string | null;
  staffRole: string | null;
  staffPosition: string | null;
};

export function OPTIONS() {
  return edgeCorsOptions();
}

export async function GET(request: Request) {
  try {
    await requireStaff(request);
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(String(searchParams.get("page") ?? "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(searchParams.get("pageSize") ?? "50"), 10) || 50));
    const includeAllRaw = String(searchParams.get("includeAll") ?? "").toLowerCase();
    const includeAll = includeAllRaw === "1" || includeAllRaw === "true";
    const offset = (page - 1) * pageSize;
    const like = `%${q}%`;

    const sql = getSql();
    const filterSearch = q.length > 0;
    const totalRows = (await sql`
      SELECT COUNT(*)::int AS total
      FROM "Participant" p
      LEFT JOIN "LoiSubmission" ls ON ls."participantId" = p.id
      WHERE (
        ${includeAll}
        OR p."fullProfileCompletedAt" IS NOT NULL
        OR (COALESCE(p."legacyPioneerImport", false) = true AND p."firebaseUid" IS NULL)
      )
      AND (
        NOT ${filterSearch}
        OR p."fullName" ILIKE ${like}
        OR p.email ILIKE ${like}
        OR p.phone ILIKE ${like}
        OR COALESCE(p."mailingAddress", '') ILIKE ${like}
        OR COALESCE(p."memberIdNo", '') ILIKE ${like}
        OR COALESCE(p."civilStatus", '') ILIKE ${like}
      )
    `) as Array<{ total: number }>;
    const total = totalRows[0]?.total ?? 0;

    const rows = (await sql`
      SELECT
        p.id AS "participantId",
        p."fullName",
        p.email,
        p.phone,
        p.dob,
        p.gender,
        p."mailingAddress",
        p."civilStatus",
        p."memberIdNo",
        ls.address AS "loiAddress",
        p."fullProfileCompletedAt",
        p."createdAt",
        COALESCE(p."legacyPioneerImport", false) AS "legacyPioneerImport",
        p."firebaseUid",
        s.role AS "staffRole"
      FROM "Participant" p
      LEFT JOIN "LoiSubmission" ls ON ls."participantId" = p.id
      LEFT JOIN "StaffUser" s ON LOWER(TRIM(s.email)) = LOWER(TRIM(p.email))
      WHERE (
        ${includeAll}
        OR p."fullProfileCompletedAt" IS NOT NULL
        OR (COALESCE(p."legacyPioneerImport", false) = true AND p."firebaseUid" IS NULL)
      )
      AND (
        NOT ${filterSearch}
        OR p."fullName" ILIKE ${like}
        OR p.email ILIKE ${like}
        OR p.phone ILIKE ${like}
        OR COALESCE(p."mailingAddress", '') ILIKE ${like}
        OR COALESCE(p."memberIdNo", '') ILIKE ${like}
        OR COALESCE(p."civilStatus", '') ILIKE ${like}
      )
      ORDER BY p."fullProfileCompletedAt" DESC NULLS LAST, p."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `) as Array<Omit<RegistryRow, "staffPosition"> & { staffRole: string | null }>;

    const mapped: RegistryRow[] = rows.map((r) => {
      const createdRaw = r.createdAt as unknown;
      return {
        ...r,
        createdAt:
          createdRaw instanceof Date ? createdRaw.toISOString() : String(createdRaw ?? ""),
        staffPosition: staffPositionLabel(r.staffRole),
      };
    });

    return NextResponse.json({ rows: mapped, total, page, pageSize }, { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
