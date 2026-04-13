import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { digitsOnly, normalizeEmail } from "@/lib/pmes-edge/norm";

/**
 * GET ?login= — same behavior as Nest `resolveLoginEmailForFirebase`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("login") ?? "").trim();
  if (!raw) {
    return NextResponse.json({ message: "login query parameter is required", statusCode: 400 }, { status: 400 });
  }

  try {
    const sql = getSql();
    if (raw.includes("@")) {
      const email = normalizeEmail(raw);
      const rows = await sql`
        SELECT email FROM "Participant" WHERE email = ${email} LIMIT 1
      `;
      const row = (rows as { email: string }[])[0];
      return row ? NextResponse.json({ email: row.email }) : notFound();
    }

    const byMemberId = await sql`
      SELECT email FROM "Participant"
      WHERE LOWER(TRIM("memberIdNo")) = LOWER(${raw.trim()})
      LIMIT 1
    `;
    const mid = (byMemberId as { email: string }[])[0];
    if (mid) return NextResponse.json({ email: mid.email });

    const tinDigits = digitsOnly(raw);
    if (tinDigits.length === 9) {
      const byTin = await sql`
        SELECT email FROM "Participant"
        WHERE LOWER(TRIM(COALESCE("tinNo", ''))) = LOWER(${tinDigits})
        LIMIT 1
      `;
      const tr = (byTin as { email: string }[])[0];
      if (tr) return NextResponse.json({ email: tr.email });
    }

    const lower = raw.toLowerCase();
    const byCallsign = await sql`
      SELECT email FROM "Participant"
      WHERE LOWER(TRIM(callsign)) = ${lower}
      LIMIT 1
    `;
    const cs = (byCallsign as { email: string }[])[0];
    if (cs) return NextResponse.json({ email: cs.email });

    const m = lower.match(/^([a-z0-9]{2,})-(\d{1,5})$/);
    if (m) {
      const slug = m[1]!;
      const seq = parseInt(m[2]!, 10);
      if (Number.isFinite(seq) && seq >= 1) {
        const bySlug = await sql`
          SELECT email FROM "Participant"
          WHERE "lastNameKey" = ${slug} AND "lastNameSeq" = ${seq}
          LIMIT 1
        `;
        const sl = (bySlug as { email: string }[])[0];
        if (sl) return NextResponse.json({ email: sl.email });
      }
    }

    return notFound();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    const isDbConfig = msg.includes("DATABASE_URL");
    const status = isDbConfig ? 503 : 500;
    return NextResponse.json({ message: msg, statusCode: status }, { status });
  }
}

function notFound() {
  return NextResponse.json({ message: "No account matches that login.", statusCode: 404 }, { status: 404 });
}
