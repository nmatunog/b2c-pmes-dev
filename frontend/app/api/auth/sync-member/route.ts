import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { verifyFirebaseIdToken } from "@/lib/firebase-edge";
import { edgeCorsOptions } from "@/lib/edge-cors";
import { resolveReferrerParticipantId } from "@/lib/referral-edge";

type SyncBody = {
  uid?: string;
  email?: string;
  fullName?: string;
  referralCode?: string;
};

function extractBearer(authorization: string | null): string | null {
  const v = String(authorization ?? "").trim();
  if (!v.toLowerCase().startsWith("bearer ")) return null;
  const t = v.slice(7).trim();
  return t || null;
}

/** Mirrors Nest `AuthService.isFirebaseAdminConfigured()` (three env vars). */
function isNestStyleFirebaseAdminConfigured(): boolean {
  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  let privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n");
  return Boolean(projectId && clientEmail && privateKey);
}

async function assertMemberSyncAuthorized(
  syncSecretHeader: string | null,
  authorization: string | null,
  dto: { uid: string; email: string },
): Promise<void> {
  const expected = String(process.env.MEMBER_SYNC_SECRET ?? "").trim();
  const hasSecret = Boolean(expected);
  const hasAdmin = isNestStyleFirebaseAdminConfigured();

  if (hasSecret && String(syncSecretHeader ?? "").trim() === expected) {
    return;
  }

  if (!hasSecret && !hasAdmin) {
    return;
  }

  const bearer = extractBearer(authorization);
  if (bearer) {
    const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
    if (!projectId) {
      throw new Error("UNAUTHORIZED: Firebase ID token verification requires FIREBASE_PROJECT_ID");
    }
    try {
      const decoded = await verifyFirebaseIdToken(bearer, projectId);
      if (decoded.sub !== dto.uid) {
        throw new Error("UNAUTHORIZED: ID token does not match uid");
      }
      const tokenEmail = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
      const bodyEmail = dto.email.trim().toLowerCase();
      if (tokenEmail && tokenEmail !== bodyEmail) {
        throw new Error("UNAUTHORIZED: ID token email does not match body");
      }
      return;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("UNAUTHORIZED:")) throw e;
      throw new Error("UNAUTHORIZED: Invalid Firebase ID token");
    }
  }

  throw new Error("UNAUTHORIZED: Invalid or missing member sync authorization");
}

function validateBody(raw: SyncBody): { uid: string; email: string; fullName?: string; referralCode?: string } {
  const uid = String(raw.uid ?? "").trim();
  const email = String(raw.email ?? "").trim();
  if (uid.length < 10 || uid.length > 128) {
    throw new Error("BAD_REQUEST: uid must be between 10 and 128 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error("BAD_REQUEST: email must be a valid address");
  }
  const fn = raw.fullName != null ? String(raw.fullName).trim() : "";
  if (fn.length > 500) {
    throw new Error("BAD_REQUEST: fullName too long");
  }
  const rc = raw.referralCode != null ? String(raw.referralCode).trim() : "";
  if (rc.length > 48) {
    throw new Error("BAD_REQUEST: referralCode too long");
  }
  return { uid, email, ...(fn ? { fullName: fn } : {}), ...(rc ? { referralCode: rc } : {}) };
}

function toIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return String(d);
}

/** Browser preflight for `POST /auth/sync-member` from Pages / custom domain. */
export async function OPTIONS() {
  return edgeCorsOptions();
}

export async function POST(request: Request) {
  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let dto: { uid: string; email: string; fullName?: string; referralCode?: string };
  try {
    dto = validateBody(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg.replace(/^BAD_REQUEST:\s*/, "") }, { status: 400 });
  }

  const syncSecret = request.headers.get("x-member-sync-secret");
  const authorization = request.headers.get("authorization");

  try {
    await assertMemberSyncAuthorized(syncSecret, authorization, dto);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg.startsWith("UNAUTHORIZED:")) {
      return NextResponse.json(
        { error: msg.replace(/^UNAUTHORIZED:\s*/, ""), statusCode: 401 },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const sql = getSql();
  const normalizedEmail = dto.email.trim().toLowerCase();
  const name = (dto.fullName?.trim() || normalizedEmail.split("@")[0] || "Member").slice(0, 500);
  const referrerId = await resolveReferrerParticipantId(sql, dto.referralCode, dto.uid);

  type Row = {
    id: string;
    firebaseUid: string | null;
    email: string;
    fullName: string;
    createdAt: Date | string;
  };

  const existingByUid = await sql`
    SELECT id, "firebaseUid", email, "fullName", "createdAt"
    FROM "Participant"
    WHERE "firebaseUid" = ${dto.uid}
    LIMIT 1
  `;
  const byUid = (existingByUid as Row[])[0];
  if (byUid) {
    const updated = await sql`
      UPDATE "Participant"
      SET "fullName" = ${name}, email = ${normalizedEmail}
      WHERE id = ${byUid.id}
      RETURNING id, "firebaseUid", email, "fullName", "createdAt"
    `;
    const row = (updated as Row[])[0];
    return NextResponse.json({
      success: true,
      message: "Member successfully synced to PostgreSQL",
      data: {
        id: row.id,
        firebaseUid: row.firebaseUid,
        email: row.email,
        fullName: row.fullName,
        createdAt: toIso(row.createdAt),
      },
    });
  }

  const existingByEmail = await sql`
    SELECT id, "firebaseUid", email, "fullName", "createdAt"
    FROM "Participant"
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;
  const byEmail = (existingByEmail as Row[])[0];
  if (byEmail) {
    if (byEmail.firebaseUid && byEmail.firebaseUid !== dto.uid) {
      return NextResponse.json(
        { error: "This email is already linked to another Firebase account.", statusCode: 409 },
        { status: 409 },
      );
    }
    const keepName = String(byEmail.fullName ?? "").trim() ? byEmail.fullName : name;
    const updated = await sql`
      UPDATE "Participant"
      SET
        "firebaseUid" = ${dto.uid},
        "fullName" = ${keepName},
        "referredByParticipantId" = COALESCE("referredByParticipantId", ${referrerId})
      WHERE id = ${byEmail.id}
      RETURNING id, "firebaseUid", email, "fullName", "createdAt"
    `;
    const row = (updated as Row[])[0];
    return NextResponse.json({
      success: true,
      message: "Firebase uid linked to existing participant",
      data: {
        id: row.id,
        firebaseUid: row.firebaseUid,
        email: row.email,
        fullName: row.fullName,
        createdAt: toIso(row.createdAt),
      },
    });
  }

  const id = crypto.randomUUID();
  const created = await sql`
    INSERT INTO "Participant" (id, "firebaseUid", email, "fullName", phone, dob, gender, "referredByParticipantId")
    VALUES (${id}, ${dto.uid}, ${normalizedEmail}, ${name}, 'pending', 'pending', 'unknown', ${referrerId})
    RETURNING id, "firebaseUid", email, "fullName", "createdAt"
  `;
  const row = (created as Row[])[0];
  return NextResponse.json({
    success: true,
    message: "Member successfully synced to PostgreSQL",
    data: {
      id: row.id,
      firebaseUid: row.firebaseUid,
      email: row.email,
      fullName: row.fullName,
      createdAt: toIso(row.createdAt),
    },
  });
}
