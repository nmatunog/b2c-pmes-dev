#!/usr/bin/env node
/**
 * Prints a bcrypt hash for ADMIN_PASSWORD_HASH in backend/.env
 * Usage (from backend/): node scripts/hash-admin-password.js 'YourSecretPassword'
 */
const bcrypt = require("bcryptjs");

const pwd = process.argv[2];
if (!pwd || pwd.length < 6) {
  console.error("Usage: node scripts/hash-admin-password.js <password-at-least-6-chars>");
  process.exit(1);
}

const hash = bcrypt.hashSync(pwd, 12);
console.log(hash);
