import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { ensureMemberPublicId } from "@/lib/pmes-edge/lifecycle";
import { normalizeEmail } from "@/lib/pmes-edge/norm";
import { loadParticipantWithRelsByEmail } from "@/lib/pmes-edge/queries";
import { validateAndNormalizeCallsignInput } from "@/lib/pmes-edge/callsign-validate";
import { isMissingMemberProfileStampColumnError } from "@/lib/pmes-edge/pg-stamp-fallback";
import { maybeCreditReferralJoin } from "@/lib/referral-edge";

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

function composeLegalFullName(personal: ReturnType<typeof asObject>): string {
  if (!personal) return "";
  const first = typeof personal.firstName === "string" ? personal.firstName.trim() : "";
  const mid = typeof personal.middleName === "string" ? personal.middleName.trim() : "";
  const last = typeof personal.lastName === "string" ? personal.lastName.trim() : "";
  const suf = typeof personal.suffixName === "string" ? personal.suffixName.trim() : "";
  const core = [first, mid, last]
    .filter(Boolean)
    .join(" ");
  if (!core) return "";
  return suf ? `${core} ${suf}`.trim() : core;
}

function normalizeProfileDob(raw: string): string | undefined {
  const t = raw.trim();
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const mm = us[1]!.padStart(2, "0");
    const dd = us[2]!.padStart(2, "0");
    return `${us[3]!}-${mm}-${dd}`;
  }
  return undefined;
}

function deriveFields(profile: unknown): {
  mailingAddress: string;
  civilStatus: string;
  memberIdNo: string;
  callsign: string;
  phone: string;
  displayFullName: string;
  sexGender: string;
} {
  const p = asObject(profile);
  if (!p) {
    return { mailingAddress: "", civilStatus: "", memberIdNo: "", callsign: "", phone: "", displayFullName: "", sexGender: "" };
  }
  const personal = asObject(p.personal);
  const contact = asObject(p.contact);
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
    phone: typeof contact?.mobileNo === "string" ? contact.mobileNo.trim() : "",
    displayFullName: composeLegalFullName(personal),
    sexGender: typeof personal?.sexGender === "string" ? personal.sexGender.trim() : "",
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
  const personalForDob = asObject(asObject(parsed)?.personal);
  const birthDateRaw =
    personalForDob && typeof personalForDob.birthDate === "string" ? personalForDob.birthDate.trim() : "";
  const dobIso = birthDateRaw ? normalizeProfileDob(birthDateRaw) : undefined;
  const phoneOut = (derived.phone.trim() ? derived.phone.trim().slice(0, 64) : participant.phone).slice(0, 64);
  const fullNameOut = (
    derived.displayFullName.trim() ? derived.displayFullName.trim().slice(0, 500) : participant.fullName
  ).slice(0, 500);
  const genderOut = (derived.sexGender.trim() ? derived.sexGender.trim().slice(0, 32) : participant.gender).slice(
    0,
    32,
  );
  const dobOut = (dobIso ?? participant.dob).slice(0, 32);
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
            phone = ${phoneOut},
            "fullName" = ${fullNameOut},
            dob = ${dobOut},
            gender = ${genderOut},
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
            phone = ${phoneOut},
            "fullName" = ${fullNameOut},
            dob = ${dobOut},
            gender = ${genderOut},
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
            phone = ${phoneOut},
            "fullName" = ${fullNameOut},
            dob = ${dobOut},
            gender = ${genderOut},
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
            phone = ${phoneOut},
            "fullName" = ${fullNameOut},
            dob = ${dobOut},
            gender = ${genderOut},
            callsign = ${callsignOut}
          WHERE id = ${withId.id}
        `;
      }
    }
    await maybeCreditReferralJoin(sql, withId.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Full profile submit failed";
    return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500 });
  }
}
