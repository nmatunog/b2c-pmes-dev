#!/usr/bin/env node
/**
 * Convert a tab-separated file (e.g. paste from Google Sheets → Save as .tsv)
 * into JSON for Admin → Legacy pioneer import.
 *
 * Expected header row (any order), column names case-insensitive:
 *   email | fullName | phone | dob | gender
 *
 * Usage:
 *   node scripts/legacy-import-tsv-to-json.mjs path/to/roster.tsv
 *   pbpaste | node scripts/legacy-import-tsv-to-json.mjs -
 *
 * DOB must be YYYY-MM-DD to match the reclaim form.
 */
import fs from "fs";

const ALIASES = {
  email: "email",
  "e-mail": "email",
  fullname: "fullName",
  name: "fullName",
  "full name": "fullName",
  phone: "phone",
  mobile: "phone",
  dob: "dob",
  birthdate: "dob",
  "date of birth": "dob",
  gender: "gender",
  sex: "gender",
};

const REQUIRED = ["email", "fullName", "phone", "dob", "gender"];

function normalizeHeader(h) {
  const k = String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return ALIASES[k] ?? null;
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
  const headers = rawHeaders.map((h) => normalizeHeader(h));
  const missing = [];
  for (const r of REQUIRED) {
    if (!headers.includes(r)) missing.push(r);
  }
  if (missing.length) {
    throw new Error(
      `Missing columns (use header names like email, fullName, phone, dob, gender): ${missing.join(", ")}`,
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      obj[key] = String(cols[j] ?? "").trim();
    }
    const row = {
      email: obj.email,
      fullName: obj.fullName,
      phone: obj.phone,
      dob: obj.dob,
      gender: obj.gender,
    };
    if (!row.email && !row.fullName) continue;
    rows.push(row);
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
