#!/usr/bin/env node
/**
 * Creates the one bootstrap superuser (only if none exists). Admins are created later by the superuser via the API.
 *
 * Usage (from backend/):
 *   node scripts/create-superuser.js you@example.com 'YourSecurePassword'
 *
 * Requires DATABASE_URL and a migrated DB (StaffUser table).
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* optional — Nest bundles dotenv */
}

const bcrypt = require("bcryptjs");
const { PrismaClient, StaffRole } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];
  if (!emailArg?.trim() || !passwordArg || passwordArg.length < 8) {
    console.error("Usage: node scripts/create-superuser.js <email> <password-min-8-chars>");
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();

  const existingSuper = await prisma.staffUser.count({ where: { role: StaffRole.SUPERUSER } });
  if (existingSuper > 0) {
    console.error("A superuser already exists. Only one bootstrap superuser is allowed; create additional staff as admins from the API.");
    process.exit(1);
  }

  const taken = await prisma.staffUser.findUnique({ where: { email } });
  if (taken) {
    console.error("That email is already registered as staff.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(passwordArg, 12);
  const user = await prisma.staffUser.create({
    data: {
      email,
      passwordHash,
      role: StaffRole.SUPERUSER,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  console.log("Superuser created:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
