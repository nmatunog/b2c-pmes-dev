#!/usr/bin/env node
/**
 * Convert tab-separated export (Google Sheets → .tsv) into JSON for Admin → Legacy pioneer import.
 *
 * Maps B2C registry-style headers to API fields; any unknown column is kept under `sheet`.
 * Minimum data: last name + first name (or fullName). Email/phone/dob optional (API synthesizes when missing).
 *
 * Usage:
 *   node scripts/legacy-import-tsv-to-json.mjs path/to/roster.tsv
 *   pbpaste | node scripts/legacy-import-tsv-to-json.mjs -
 */
import fs from "fs";

/** Normalize header: lowercase, collapse spaces */
function normKey(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * B2C registry + common aliases → ImportLegacyPioneerRowDto field names.
 * Returns null if the column should be stored only under `sheet`.
 */
function mapHeader(h) {
  const k = normKey(h);
  const map = {
    email: "email",
    "e-mail": "email",
    fullname: "fullName",
    name: "fullName",
    "full name": "fullName",
    "last name": "lastName",
    "first name": "firstName",
    "middle name": "middleName",
    phone: "phone",
    mobile: "phone",
    dob: "dob",
    birthdate: "dob",
    "date of birth": "dob",
    gender: "gender",
    sex: "gender",
    "sex/gender": "sexGender",
    timestamp: "registryTimestamp",
    "civil status": "civilStatus",
    street: "street",
    barangay: "barangay",
    "city/ municipality": "cityMunicipality",
    "city/municipality": "cityMunicipality",
    city: "cityMunicipality",
    municipality: "cityMunicipality",
    province: "province",
    "tin no.": "tinNo",
    "tin no": "tinNo",
    "tin": "tinNo",
    "initial subscription amount": "initialSubscriptionAmount",
    "paid up share amount": "paidUpShareAmount",
    religion: "religion",
  };
  return map[k] ?? null;
}

function parseTsv(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Need a header row and at least one data row.");
  }

  const rawHeaders = lines[0].split("\t").map((c) => c.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^b2c consumers cooperative/i.test(line.split("\t")[0] ?? "")) continue;

    const cols = line.split("\t");
    const top = {};
    const sheet = {};

    for (let j = 0; j < rawHeaders.length; j++) {
      const headerLabel = rawHeaders[j];
      const val = String(cols[j] ?? "").trim();
      if (!headerLabel) continue;
      const mapped = mapHeader(headerLabel);
      if (mapped) {
        top[mapped] = val;
      } else if (val !== "") {
        sheet[headerLabel] = val;
      }
    }

    const hasName =
      (top.fullName && top.fullName.length > 1) ||
      (top.firstName && top.lastName) ||
      (top.firstName && top.firstName.length > 0) ||
      (top.lastName && top.lastName.length > 0);

    if (!hasName) continue;

    const out = { ...top };
    if (Object.keys(sheet).length > 0) out.sheet = sheet;
    rows.push(out);
  }

  if (rows.length === 0) {
    throw new Error("No data rows with names (last/first or fullName). Check header row matches your sheet.");
  }
  return rows;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/legacy-import-tsv-to-json.mjs <file.tsv|- for stdin>");
  process.exit(1);
}

const text =
  inputPath === "-"
    ? fs.readFileSync(0, "utf8")
    : fs.readFileSync(inputPath, "utf8");

const rows = parseTsv(text);
process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
