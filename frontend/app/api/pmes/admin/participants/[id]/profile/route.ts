import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { EDGE_CORS_HEADERS, edgeCorsOptions } from "@/lib/edge-cors";
import {
  FIREBASE_ADMIN_MISSING_MSG,
  hasFirebaseServiceAccountConfig,
  identityToolkitLookupByEmail,
  identityToolkitPatchUser,
  normalizeMemberEmail,
} from "@/lib/firebase-admin-rest";
import { buildAdminParticipantDetailJson } from "@/lib/pmes-edge/build-admin-participant-detail";
import { requireStaff, unauthorized } from "@/lib/staff-edge-auth";

export function OPTIONS() {
  return edgeCorsOptions();
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

type PatchBody = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  dob?: unknown;
  gender?: unknown;
  tinNo?: unknown;
  mailingAddress?: unknown;
  civilStatus?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(request);
    const { id } = await context.params;
    const participantId = String(id ?? "").trim();
    if (!participantId) {
      return NextResponse.json({ message: "participant id is required", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ message: "Invalid JSON body", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
    }

    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        email,
        "fullName",
        phone,
        dob,
        gender,
        "tinNo",
        "mailingAddress",
        "civilStatus",
        "firebaseUid"
      FROM "Participant"
      WHERE id = ${participantId}
      LIMIT 1
    `) as Array<{
      id: string;
      email: string;
      fullName: string;
      phone: string;
      dob: string;
      gender: string;
      tinNo: string | null;
      mailingAddress: string | null;
      civilStatus: string | null;
      firebaseUid: string | null;
    }>;

    const cur = rows[0];
    if (!cur) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }

    let fullName = cur.fullName;
    let email = cur.email;
    let phone = cur.phone;
    let dob = cur.dob;
    let gender = cur.gender;
    let tinNo = cur.tinNo;
    let mailingAddress = cur.mailingAddress;
    let civilStatus = cur.civilStatus;

    if (body.fullName !== undefined) {
      const v = String(body.fullName ?? "").trim();
      if (!v || v.length > 500) {
        return NextResponse.json({ message: "fullName must be 1–500 characters", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
      }
      fullName = v;
    }
    if (body.phone !== undefined) {
      const v = String(body.phone ?? "").trim();
      if (v.length > 64) {
        return NextResponse.json({ message: "phone too long", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
      }
      phone = v;
    }
    if (body.dob !== undefined) {
      const v = String(body.dob ?? "").trim();
      if (v.length > 32) {
        return NextResponse.json({ message: "dob too long", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
      }
      dob = v;
    }
    if (body.gender !== undefined) {
      const v = String(body.gender ?? "").trim();
      if (v.length > 32) {
        return NextResponse.json({ message: "gender too long", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
      }
      gender = v;
    }
    if (body.tinNo !== undefined) {
      const d = digitsOnly(String(body.tinNo ?? ""));
      tinNo = d ? d.slice(0, 20) : null;
    }
    if (body.mailingAddress !== undefined) {
      const v = String(body.mailingAddress ?? "").trim();
      mailingAddress = v ? v.slice(0, 4000) : null;
    }
    if (body.civilStatus !== undefined) {
      const v = String(body.civilStatus ?? "").trim();
      civilStatus = v ? v.slice(0, 64) : null;
    }

    if (body.email !== undefined) {
      const nextEmail = normalizeMemberEmail(String(body.email ?? ""));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return NextResponse.json({ message: "Invalid email", statusCode: 400 }, { status: 400, headers: EDGE_CORS_HEADERS });
      }
      if (nextEmail !== normalizeMemberEmail(cur.email)) {
        const clash = (await sql`
          SELECT id FROM "Participant"
          WHERE LOWER(TRIM(email)) = ${nextEmail} AND id <> ${participantId}
          LIMIT 1
        `) as Array<{ id: string }>;
        if (clash[0]) {
          return NextResponse.json(
            { message: "That email is already used by another member record.", statusCode: 409 },
            { status: 409, headers: EDGE_CORS_HEADERS },
          );
        }
        const uid = cur.firebaseUid?.trim();
        const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
        if (uid) {
          if (!projectId) {
            return NextResponse.json(
              { message: "Cannot change sign-in email: FIREBASE_PROJECT_ID is not configured on the server.", statusCode: 503 },
              { status: 503, headers: EDGE_CORS_HEADERS },
            );
          }
          if (!hasFirebaseServiceAccountConfig()) {
            return NextResponse.json(
              { message: FIREBASE_ADMIN_MISSING_MSG, statusCode: 503 },
              { status: 503, headers: EDGE_CORS_HEADERS },
            );
          }
          try {
            const existingFb = await identityToolkitLookupByEmail(projectId, nextEmail);
            if (existingFb && existingFb.localId !== uid) {
              return NextResponse.json(
                { message: "That email is already used by another Firebase account.", statusCode: 409 },
                { status: 409, headers: EDGE_CORS_HEADERS },
              );
            }
            await identityToolkitPatchUser(projectId, uid, { email: nextEmail });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Firebase email update failed";
            const status = /already registered|EMAIL_EXISTS|USER_NOT_FOUND/i.test(msg)
              ? /USER_NOT_FOUND/i.test(msg)
                ? 400
                : 409
              : 502;
            return NextResponse.json({ message: msg, statusCode: status }, { status, headers: EDGE_CORS_HEADERS });
          }
        }
        email = nextEmail;
      }
    }

    await sql`
      UPDATE "Participant"
      SET
        "fullName" = ${fullName},
        email = ${email},
        phone = ${phone},
        dob = ${dob},
        gender = ${gender},
        "tinNo" = ${tinNo},
        "mailingAddress" = ${mailingAddress},
        "civilStatus" = ${civilStatus}
      WHERE id = ${participantId}
    `;

    const out = await buildAdminParticipantDetailJson(participantId);
    if (!out) {
      return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404, headers: EDGE_CORS_HEADERS });
    }
    return NextResponse.json(out, { headers: EDGE_CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(message);
  }
}
