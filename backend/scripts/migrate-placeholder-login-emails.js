#!/usr/bin/env node
/**
 * One-time migration:
 * - Finds members with placeholder Firebase login emails (`@b2c-registry.example.com`)
 * - Reads real contact email from submitted full-profile payload
 * - Updates Firebase Auth primary email + Participant.email
 *
 * Dry-run by default.
 *
 * Usage (from backend/):
 *   node scripts/migrate-placeholder-login-emails.js
 *   node scripts/migrate-placeholder-login-emails.js --apply
 *   node scripts/migrate-placeholder-login-emails.js --apply --limit=100
 *
 * Required env:
 * - DATABASE_URL
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* optional */
}

const admin = require("firebase-admin");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = { apply: false, limit: 0 };
  for (const a of argv.slice(2)) {
    if (a === "--apply") out.apply = true;
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    }
  }
  return out;
}

function isValidEmail(raw) {
  const s = String(raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 320;
}

function isPlaceholderEmail(raw) {
  return String(raw || "").trim().toLowerCase().endsWith("@b2c-registry.example.com");
}

function extractContactEmail(participant) {
  const snap = participant.memberProfileSnapshot;
  if (snap && typeof snap === "object") {
    const contact = snap.contact;
    if (contact && typeof contact === "object" && typeof contact.emailAddress === "string") {
      const fromSnap = contact.emailAddress.trim().toLowerCase();
      if (isValidEmail(fromSnap)) return fromSnap;
    }
  }
  const fp = String(participant.fullProfileJson || "").trim();
  if (!fp) return "";
  try {
    const env = JSON.parse(fp);
    const profile = env && typeof env === "object" ? env.profile : null;
    const contact = profile && typeof profile === "object" ? profile.contact : null;
    const fromEnv = contact && typeof contact === "object" ? String(contact.emailAddress || "").trim().toLowerCase() : "";
    return isValidEmail(fromEnv) ? fromEnv : "";
  } catch {
    return "";
  }
}

function initFirebaseAdmin() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  let privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.auth();
}

async function emailTakenInFirebase(auth, targetEmail, uid) {
  try {
    const u = await auth.getUserByEmail(targetEmail);
    return Boolean(u && u.uid !== uid);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "auth/user-not-found") return false;
    throw e;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const auth = initFirebaseAdmin();
  const dryRun = !args.apply;

  const rows = await prisma.participant.findMany({
    where: {
      fullProfileCompletedAt: { not: null },
      firebaseUid: { not: null },
      email: { endsWith: "@b2c-registry.example.com", mode: "insensitive" },
    },
    select: {
      id: true,
      firebaseUid: true,
      email: true,
      memberProfileSnapshot: true,
      fullProfileJson: true,
    },
    ...(args.limit > 0 ? { take: args.limit } : {}),
  });

  let scanned = 0;
  let eligible = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of rows) {
    scanned++;
    const uid = String(p.firebaseUid || "").trim();
    const current = String(p.email || "").trim().toLowerCase();
    if (!uid || !isPlaceholderEmail(current)) {
      skipped++;
      continue;
    }

    const target = extractContactEmail(p);
    if (!isValidEmail(target) || isPlaceholderEmail(target) || target === current) {
      skipped++;
      continue;
    }

    const dbTaken = await prisma.participant.findUnique({
      where: { email: target },
      select: { id: true, firebaseUid: true },
    });
    if (dbTaken && dbTaken.id !== p.id && dbTaken.firebaseUid && dbTaken.firebaseUid !== uid) {
      console.warn(`[skip:db-conflict] ${p.id} ${current} -> ${target}`);
      skipped++;
      continue;
    }

    const firebaseTaken = await emailTakenInFirebase(auth, target, uid);
    if (firebaseTaken) {
      console.warn(`[skip:firebase-conflict] ${p.id} ${current} -> ${target}`);
      skipped++;
      continue;
    }

    eligible++;
    if (dryRun) {
      console.log(`[dry-run] ${p.id} ${current} -> ${target}`);
      continue;
    }

    try {
      await auth.updateUser(uid, { email: target });
      await prisma.participant.update({
        where: { id: p.id },
        data: { email: target },
      });
      updated++;
      console.log(`[updated] ${p.id} ${current} -> ${target}`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[failed] ${p.id} ${current} -> ${target} | ${msg}`);
    }
  }

  console.log("");
  console.log("Migration summary");
  console.log(`- mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`- scanned: ${scanned}`);
  console.log(`- eligible: ${eligible}`);
  console.log(`- updated: ${updated}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- failed: ${failed}`);
  if (dryRun) {
    console.log("");
    console.log("Run with --apply to perform updates.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
