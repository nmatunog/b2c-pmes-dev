import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { ensureMemberPublicId } from "@/lib/pmes-edge/lifecycle";
import { normalizeEmail } from "@/lib/pmes-edge/norm";
import { loadParticipantWithRelsByEmail } from "@/lib/pmes-edge/queries";
import { validateAndNormalizeCallsignInput } from "@/lib/pmes-edge/callsign-validate";
import { isMissingMemberProfileStampColumnError } from "@/lib/pmes-edge/pg-stamp-fallback";

type Body = {
  email?: string;
  profileJson?: string;
  sheetFileName?: string;
  notes?: string;
  expectedProfileRecordVersion?: number;
};

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function deriveFields(profile: unknown): { mailingAddress: string; civilStatus: string; memberIdNo: string; callsign: string } {
  const p = asObject(profile);
  if (!p) return { mailingAddress: "", civilStatus: "", memberIdNo: "", callsign: "" };
  const personal = asObject(p.personal);
  const present = asObject(p.presentAddress);
  const parts = [
    present?.houseNo,
    present?.street,
    present?.subdivision,
    present?.barangay,
    present?.cityMunicipality,
    present?.province,
    present?.region,
    present?.country,
    present?.postalCode,
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return {
    mailingAddress: parts.join(", "),
    civilStatus: typeof personal?.civilStatus === "string" ? personal.civilStatus.trim() : "",
    memberIdNo: typeof personal?.memberIdNo === "string" ? personal.memberIdNo.trim() : "",
    callsign: typeof personal?.callsign === "string" ? personal.callsign.trim() : "",
  };
}

function validate(d: Body) {
  const emailRaw = String(d.email ?? "").trim();
  const profileJson = String(d.profileJson ?? "");
  const sheetFileName = String(d.sheetFileName ?? "");
  const notes = String(d.notes ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 320) {
    throw new Error("email must be valid");
  }
  if (!profileJson || profileJson.length < 4) {
    throw new Error("profileJson is required");
  }
  if (sheetFileName.length > 500) throw new Error("sheetFileName must be at most 500 characters");
  if (notes.length > 5000) throw new Error("notes must be at most 5000 characters");
  const expected =
    typeof d.expectedProfileRecordVersion === "number" && Number.isFinite(d.expectedProfileRecordVersion)
      ? d.expectedProfileRecordVersion
      : undefined;
  return {
    email: normalizeEmail(emailRaw),
    profileJson,
    sheetFileName,
    notes,
    expectedProfileRecordVersion: expected,
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body", statusCode: 400 }, { status: 400 });
  }

  let dto: ReturnType<typeof validate>;
  try {
    dto = validate(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ message: msg, statusCode: 400 }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(dto.profileJson) as unknown;
  } catch {
    return NextResponse.json({ message: "profileJson must be valid JSON.", statusCode: 400 }, { status: 400 });
  }

  const sql = getSql();
  const participant = await loadParticipantWithRelsByEmail(sql, dto.email);
  if (!participant) {
    return NextResponse.json({ message: "Participant not found", statusCode: 404 }, { status: 404 });
  }
  if (!participant.boardApprovedAt) {
    return NextResponse.json(
      { message: "Board approval is required before submitting the full member profile.", statusCode: 400 },
      { status: 400 },
    );
  }
  if (participant.fullProfileCompletedAt) {
    return NextResponse.json({ message: "Full profile was already submitted.", statusCode: 400 }, { status: 400 });
  }
  if (
    dto.expectedProfileRecordVersion !== undefined &&
    participant.memberProfileConcurrencyStamp !== dto.expectedProfileRecordVersion
  ) {
    return NextResponse.json(
      {
        message: "This profile was updated elsewhere (another tab, session, or staff). Refresh the page, then submit again.",
        statusCode: 409,
      },
      { status: 409 },
    );
  }

  const withId = await ensureMemberPublicId(sql, participant, parsed);
  const derived = deriveFields(parsed);
  let callsignOut: string | null = null;
  if (derived.callsign) {
    try {
      callsignOut = validateAndNormalizeCallsignInput(derived.callsign);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid callsign";
      return NextResponse.json({ message: msg, statusCode: 400 }, { status: 400 });
    }
    const clash = await sql`
      SELECT id FROM "Participant"
      WHERE id <> ${withId.id}
        AND (
          LOWER(TRIM(callsign)) = ${callsignOut}
          OR LOWER(TRIM("memberIdNo")) = LOWER(${callsignOut})
        )
      LIMIT 1
    `;
    if ((clash as { id: string }[]).length > 0) {
      return NextResponse.json(
        { message: "That handle is already in use. Choose a different one.", statusCode: 409 },
        { status: 409 },
      );
    }
  }

  const payload = {
    formVersion: "b2c-membership-v1",
    profile: parsed,
    sheetFileName: dto.sheetFileName,
    notes: dto.notes,
    submittedAt: new Date().toISOString(),
  };

  try {
    if (dto.expectedProfileRecordVersion !== undefined) {
      try {
        const updated = await sql`
          UPDATE "Participant"
          SET
            "fullProfileCompletedAt" = NOW(),
            "fullProfileJson" = ${JSON.stringify(payload)},
            "memberProfileSnapshot" = ${parsed as never},
            "mailingAddress" = ${derived.mailingAddress || null},
            "civilStatus" = ${derived.civilStatus || null},
            "memberIdNo" = ${withId.memberIdNo?.trim() || derived.memberIdNo || null},
            callsign = ${callsignOut},
            "memberProfileConcurrencyStamp" = "memberProfileConcurrencyStamp" + 1
          WHERE id = ${withId.id}
            AND "memberProfileConcurrencyStamp" = ${dto.expectedProfileRecordVersion}
          RETURNING id
        `;
        if ((updated as { id: string }[]).length === 0) {
          return NextResponse.json(
            {
              message:
                "This profile was updated elsewhere (another tab, session, or staff). Refresh the page, then submit again.",
              statusCode: 409,
            },
            { status: 409 },
          );
        }
      } catch (e) {
        if (!isMissingMemberProfileStampColumnError(e)) throw e;
        await sql`
          UPDATE "Participant"
          SET
            "fullProfileCompletedAt" = NOW(),
            "fullProfileJson" = ${JSON.stringify(payload)},
            "memberProfileSnapshot" = ${parsed as never},
            "mailingAddress" = ${derived.mailingAddress || null},
            "civilStatus" = ${derived.civilStatus || null},
            "memberIdNo" = ${withId.memberIdNo?.trim() || derived.memberIdNo || null},
            callsign = ${callsignOut}
          WHERE id = ${withId.id}
        `;
      }
    } else {
      try {
        await sql`
          UPDATE "Participant"
          SET
            "fullProfileCompletedAt" = NOW(),
            "fullProfileJson" = ${JSON.stringify(payload)},
            "memberProfileSnapshot" = ${parsed as never},
            "mailingAddress" = ${derived.mailingAddress || null},
            "civilStatus" = ${derived.civilStatus || null},
            "memberIdNo" = ${withId.memberIdNo?.trim() || derived.memberIdNo || null},
            callsign = ${callsignOut},
            "memberProfileConcurrencyStamp" = "memberProfileConcurrencyStamp" + 1
          WHERE id = ${withId.id}
        `;
      } catch (e) {
        if (!isMissingMemberProfileStampColumnError(e)) throw e;
        await sql`
          UPDATE "Participant"
          SET
            "fullProfileCompletedAt" = NOW(),
            "fullProfileJson" = ${JSON.stringify(payload)},
            "memberProfileSnapshot" = ${parsed as never},
            "mailingAddress" = ${derived.mailingAddress || null},
            "civilStatus" = ${derived.civilStatus || null},
            "memberIdNo" = ${withId.memberIdNo?.trim() || derived.memberIdNo || null},
            callsign = ${callsignOut}
          WHERE id = ${withId.id}
        `;
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Full profile submit failed";
    return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500 });
  }
}
