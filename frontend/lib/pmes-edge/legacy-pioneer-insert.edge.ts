/**
 * Edge Worker: insert one legacy pioneer row (mirrors Nest `tryCreateLegacyPioneerParticipant`).
 * Keep in sync with `backend/src/pmes/pmes.service.ts` legacy import helpers.
 */
import { randomUUID } from "node:crypto";
import type { getSql } from "@/lib/db";

type Sql = ReturnType<typeof getSql>;

const REGISTRY_PLACEHOLDER_SUFFIX = "@b2c-registry.example.com";

export type LegacyPioneerRowInput = {
  email?: string;
  fullName?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  sexGender?: string;
  civilStatus?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  tinNo?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function digitsOnly(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizeTinDigits(raw: string | undefined): string {
  let d = digitsOnly(raw);
  while (d.length > 9) {
    d = d.slice(0, -3);
  }
  return d;
}

function composeLegacyFullName(row: LegacyPioneerRowInput): string | null {
  const direct = row.fullName?.trim();
  if (direct) return direct;
  const f = row.firstName?.trim() ?? "";
  const m = row.middleName?.trim() ?? "";
  const l = row.lastName?.trim() ?? "";
  if (!f && !l) return null;
  return [f, m, l].filter(Boolean).join(" ").trim() || null;
}

function resolveLegacyGender(row: LegacyPioneerRowInput): string | null {
  const g = row.gender?.trim() || row.sexGender?.trim();
  return g || null;
}

function synthesizeLegacyImportEmail(row: LegacyPioneerRowInput): string {
  const fromRow = row.email?.trim();
  if (fromRow) return normalizeEmail(fromRow);
  const tin = normalizeTinDigits(row.tinNo);
  if (tin.length >= 6) return normalizeEmail(`tin-${tin}@b2c-registry.example.com`);
  return normalizeEmail(`legacy-${randomUUID()}@b2c-registry.example.com`);
}

function buildLegacyMailingAddress(row: LegacyPioneerRowInput): string | null {
  const parts = [
    row.street?.trim(),
    row.barangay?.trim(),
    row.cityMunicipality?.trim(),
    row.province?.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function buildRegistryImportSnapshot(
  row: LegacyPioneerRowInput,
  meta: { resolvedEmail: string; dobPlaceholder: boolean },
): Record<string, unknown> {
  const flat: Record<string, unknown> = {
    email: row.email ?? null,
    fullName: row.fullName ?? null,
    lastName: row.lastName ?? null,
    firstName: row.firstName ?? null,
    middleName: row.middleName ?? null,
    phone: row.phone ?? null,
    dob: row.dob ?? null,
    gender: row.gender ?? null,
    sexGender: row.sexGender ?? null,
    civilStatus: row.civilStatus ?? null,
    street: row.street ?? null,
    barangay: row.barangay ?? null,
    cityMunicipality: row.cityMunicipality ?? null,
    province: row.province ?? null,
    tinNo: normalizeTinDigits(row.tinNo) || null,
    tinNoAsImported: row.tinNo?.trim() || null,
    resolvedEmail: meta.resolvedEmail,
    dobPlaceholder: meta.dobPlaceholder,
    importedAt: new Date().toISOString(),
    source: "superuser_add_legacy_member",
  };
  for (const k of Object.keys(flat)) {
    const v = flat[k];
    if (v === undefined || v === null || v === "") {
      delete flat[k];
    }
  }
  return flat;
}

export async function insertLegacyPioneerRow(
  sql: Sql,
  row: LegacyPioneerRowInput,
): Promise<{ ok: true; email: string } | { ok: false; email: string; reason: string }> {
  const fullName = composeLegacyFullName(row);
  if (!fullName || fullName.length < 2) {
    return { ok: false, email: row.email ?? "(no email)", reason: "fullName_or_name_parts_required" };
  }

  const genderRaw = resolveLegacyGender(row);
  const gender = (genderRaw && genderRaw.length > 0 ? genderRaw : "Unknown").slice(0, 80);

  const email = synthesizeLegacyImportEmail(row);
  const existing = await sql`
    SELECT id, "legacyPioneerImport" FROM "Participant" WHERE email = ${email} LIMIT 1
  `;
  const ex = (existing as { id: string; legacyPioneerImport: boolean }[])[0];
  if (ex) {
    return {
      ok: false,
      email,
      reason: ex.legacyPioneerImport ? "already_imported" : "email_already_registered",
    };
  }

  const dobRaw = row.dob?.trim();
  const dobPlaceholder = !dobRaw || dobRaw.length < 4;
  const dob = dobPlaceholder ? "1900-01-01" : dobRaw.slice(0, 64);

  const phone =
    row.phone?.trim() && row.phone.trim().length >= 5 ? row.phone.trim().slice(0, 80) : "+639000000000";

  const mailing = buildLegacyMailingAddress(row);
  const tinDigitsRaw = normalizeTinDigits(row.tinNo);
  const tinStored = (tinDigitsRaw.length > 0 ? tinDigitsRaw : "000000000").slice(0, 80);
  const civil = row.civilStatus?.trim().slice(0, 80) ?? null;

  const snapshot = buildRegistryImportSnapshot(row, { resolvedEmail: email, dobPlaceholder });
  const loiAddress =
    mailing?.trim() || "(Imported — confirm or update in your membership form)";

  const participantId = randomUUID();
  const pmesId = randomUUID();
  const loiId = randomUUID();

  try {
    await sql`
      INSERT INTO "Participant" (
        id, "fullName", email, phone, dob, gender, "createdAt",
        "legacyPioneerImport", "registryImportSnapshot", "tinNo",
        "initialFeesPaidAt", "boardApprovedAt", "mailingAddress", "civilStatus",
        "memberProfileConcurrencyStamp"
      )
      VALUES (
        ${participantId},
        ${fullName.slice(0, 500)},
        ${email},
        ${phone},
        ${dob},
        ${gender},
        NOW(),
        true,
        ${JSON.stringify(snapshot)}::jsonb,
        ${tinStored},
        NOW(),
        NOW(),
        ${mailing},
        ${civil},
        0
      )
    `;
    await sql`
      INSERT INTO "PmesRecord" (id, score, passed, "timestamp", "participantId")
      VALUES (${pmesId}, 10, true, NOW(), ${participantId})
    `;
    await sql`
      INSERT INTO "LoiSubmission" (id, address, occupation, employer, "initialCapital", "submittedAt", "participantId")
      VALUES (
        ${loiId},
        ${loiAddress.slice(0, 2000)},
        'Legacy pioneer',
        '—',
        0,
        NOW(),
        ${participantId}
      )
    `;
    return { ok: true, email };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    try {
      await sql`DELETE FROM "Participant" WHERE id = ${participantId}`;
    } catch {
      /* best-effort */
    }
    return { ok: false, email, reason: msg };
  }
}
