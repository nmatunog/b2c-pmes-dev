import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { computeAlternatePublicHandle } from "@/lib/pmes-edge/callsign";
import { validateAndNormalizeCallsignInput } from "@/lib/pmes-edge/callsign-validate";
import { assertMemberEmailMatchesFirebaseToken } from "@/lib/pmes-edge/member-bearer";
import { normalizeEmail } from "@/lib/pmes-edge/norm";
import { isMissingMemberProfileStampColumnError } from "@/lib/pmes-edge/pg-stamp-fallback";

type Body = {
  email?: string;
  callsign?: string | null;
};

export async function PATCH(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = String(body.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 320) {
    return NextResponse.json({ message: "email must be valid", statusCode: 400 }, { status: 400 });
  }
  const email = normalizeEmail(emailRaw);

  try {
    await assertMemberEmailMatchesFirebaseToken(request.headers.get("authorization"), email);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg.startsWith("UNAUTHORIZED:")) {
      return NextResponse.json(
        { message: msg.replace(/^UNAUTHORIZED:\s*/, ""), statusCode: 401 },
        { status: 401 },
      );
    }
    return NextResponse.json({ message: msg, statusCode: 401 }, { status: 401 });
  }

  const sql = getSql();

  const found = await sql`
    SELECT id, callsign, "lastNameKey", "lastNameSeq" FROM "Participant" WHERE email = ${email} LIMIT 1
  `;
  const participant = (found as { id: string; callsign: string | null; lastNameKey: string | null; lastNameSeq: number | null }[])[0];
  if (!participant) {
    return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404 });
  }

  const raw = body.callsign === undefined || body.callsign === null ? "" : String(body.callsign).trim();

  try {
    if (!raw) {
      let updated: { callsign: string | null; lastNameKey: string | null; lastNameSeq: number | null }[];
      try {
        updated = (await sql`
          UPDATE "Participant"
          SET
            callsign = NULL,
            "memberProfileConcurrencyStamp" = "memberProfileConcurrencyStamp" + 1
          WHERE id = ${participant.id}::uuid
          RETURNING callsign, "lastNameKey", "lastNameSeq"
        `) as typeof updated;
      } catch (e) {
        if (!isMissingMemberProfileStampColumnError(e)) throw e;
        updated = (await sql`
          UPDATE "Participant"
          SET callsign = NULL
          WHERE id = ${participant.id}::uuid
          RETURNING callsign, "lastNameKey", "lastNameSeq"
        `) as typeof updated;
      }
      const u = updated[0]!;
      return NextResponse.json({
        success: true as const,
        callsign: null as string | null,
        alternatePublicHandle: computeAlternatePublicHandle({
          callsign: null,
          lastNameKey: u.lastNameKey,
          lastNameSeq: u.lastNameSeq,
        }),
      });
    }

    const normalized = validateAndNormalizeCallsignInput(raw);

    const clash = await sql`
      SELECT id FROM "Participant"
      WHERE id <> ${participant.id}::uuid
        AND (
          LOWER(TRIM(callsign)) = ${normalized}
          OR LOWER(TRIM("memberIdNo")) = LOWER(${normalized})
        )
      LIMIT 1
    `;
    if ((clash as { id: string }[]).length > 0) {
      return NextResponse.json(
        { message: "That handle is already in use. Choose a different one.", statusCode: 409 },
        { status: 409 },
      );
    }

    let updated: { callsign: string | null; lastNameKey: string | null; lastNameSeq: number | null }[];
    try {
      updated = (await sql`
        UPDATE "Participant"
        SET
          callsign = ${normalized},
          "memberProfileConcurrencyStamp" = "memberProfileConcurrencyStamp" + 1
        WHERE id = ${participant.id}::uuid
        RETURNING callsign, "lastNameKey", "lastNameSeq"
      `) as typeof updated;
    } catch (e) {
      if (!isMissingMemberProfileStampColumnError(e)) throw e;
      updated = (await sql`
        UPDATE "Participant"
        SET callsign = ${normalized}
        WHERE id = ${participant.id}::uuid
        RETURNING callsign, "lastNameKey", "lastNameSeq"
      `) as typeof updated;
    }
    const u = updated[0]!;
    return NextResponse.json({
      success: true as const,
      callsign: normalized,
      alternatePublicHandle: computeAlternatePublicHandle({
        callsign: u.callsign,
        lastNameKey: u.lastNameKey,
        lastNameSeq: u.lastNameSeq,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    if (msg.includes("Callsign must") || msg.includes("reserved") || msg.includes("letters")) {
      return NextResponse.json({ message: msg, statusCode: 400 }, { status: 400 });
    }
    return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500 });
  }
}
