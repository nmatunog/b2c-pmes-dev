type JsonObject = Record<string, unknown>;

/** Exported for merging server-assigned fields into profile JSON. */
export function asObject(x: unknown): JsonObject | null {
  if (x && typeof x === "object" && !Array.isArray(x)) return x as JsonObject;
  return null;
}

/** Concatenate present-address fields into one mailing line (Philippines-style). */
export function formatPresentAddressMailing(present: unknown): string {
  const a = asObject(present);
  if (!a) return "";
  const parts = [
    a.houseNo,
    a.street,
    a.subdivision,
    a.barangay,
    a.cityMunicipality,
    a.province,
    a.region,
    a.country,
    a.postalCode,
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

export type DerivedMemberRegistryFields = {
  mailingAddress: string;
  civilStatus: string;
  memberIdNo: string;
  /** `contact.mobileNo` — maps to `Participant.phone`. */
  phone: string;
  /** Composed from `personal` name fields — maps to `Participant.fullName` when non-empty. */
  displayFullName: string;
  /** `personal.sexGender` — maps to `Participant.gender` when non-empty. */
  sexGender: string;
};

/** Legal display name from membership form `personal` (aligned with client `composeFullName`). */
export function composeLegalFullNameFromPersonal(personal: JsonObject | null | undefined): string {
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

/** Normalize profile `birthDate` to `YYYY-MM-DD` for `Participant.dob` when possible. */
export function normalizeProfileDobForParticipantColumn(raw: string): string | undefined {
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

/** Map raw membership form JSON (client `profileJson`) to DB columns + snapshot. */
export function deriveFromMemberProfile(profile: unknown): DerivedMemberRegistryFields {
  const p = asObject(profile);
  if (!p) {
    return { mailingAddress: "", civilStatus: "", memberIdNo: "", phone: "", displayFullName: "", sexGender: "" };
  }
  const personal = asObject(p.personal);
  const contact = asObject(p.contact);
  const civilStatus = typeof personal?.civilStatus === "string" ? personal.civilStatus.trim() : "";
  const memberIdNo = typeof personal?.memberIdNo === "string" ? personal.memberIdNo.trim() : "";
  const mailingAddress = formatPresentAddressMailing(p.presentAddress);
  const phone = typeof contact?.mobileNo === "string" ? contact.mobileNo.trim() : "";
  const displayFullName = composeLegalFullNameFromPersonal(personal);
  const sexGender = typeof personal?.sexGender === "string" ? personal.sexGender.trim() : "";
  return { mailingAddress, civilStatus, memberIdNo, phone, displayFullName, sexGender };
}

export type FullProfileEnvelope = {
  formVersion?: string;
  profile?: unknown;
  sheetFileName?: string;
  notes?: string;
  submittedAt?: string;
};

export function parseFullProfileEnvelope(fullProfileJson: string | null): FullProfileEnvelope | null {
  if (!fullProfileJson?.trim()) return null;
  try {
    const v = JSON.parse(fullProfileJson) as unknown;
    const o = asObject(v);
    return o ?? null;
  } catch {
    return null;
  }
}
