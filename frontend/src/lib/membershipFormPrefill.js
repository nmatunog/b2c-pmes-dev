/**
 * Merge PMES registration / account data into the full membership sheet (best-effort).
 */

/** @param {string} fullName */
export function splitFullNameForPrefill(fullName) {
  const s = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return { firstName: "", middleName: "", lastName: "" };
  if (s.includes(",")) {
    const idx = s.indexOf(",");
    const lastName = s.slice(0, idx).trim();
    const rest = s
      .slice(idx + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return {
      lastName,
      firstName: rest[0] || "",
      middleName: rest.slice(1).join(" ") || "",
    };
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/** PMES uses HTML date (yyyy-mm-dd); membership sheet uses mm/dd/yyyy. */
export function registrationDobToBirthDate(dob) {
  const s = String(dob || "").trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${m}/${d}/${y}`;
  }
  return s;
}

/** Map registration gender strings to membership form SEX_GENDER_OPTIONS values. */
export function mapRegistrationGenderToSexGender(gender) {
  const t = String(gender || "")
    .trim()
    .toLowerCase();
  if (!t) return "";
  if (t === "male" || t === "m") return "Male";
  if (t === "female" || t === "f") return "Female";
  const opts = ["Female", "Male", "Non-binary", "Prefer not to say"];
  const hit = opts.find((o) => o.toLowerCase() === t);
  return hit || "";
}
