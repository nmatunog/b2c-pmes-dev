#!/usr/bin/env bash
# Load B2C registry fixture into Postgres via POST /pmes/admin/import-legacy-pioneers
# Requires: API running (e.g. npm run dev), STAFF_EMAIL + STAFF_PASSWORD for an admin account.
#
# Usage:
#   export STAFF_EMAIL='you@example.com'
#   export STAFF_PASSWORD='your-password'
#   export API_URL='http://localhost:3000'   # optional
#   bash scripts/run-legacy-import-fixture.sh
#
# Fixture: scripts/fixtures/b2c-registry-pioneers.import.json (B2C registry scan; 24 rows;
# sparse/duplicate-TIN rows use explicit test emails — see fixture notes in sheet.*.note.)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3000}"
FIXTURE="${ROOT}/scripts/fixtures/b2c-registry-pioneers.import.json"

if [[ ! -f "$FIXTURE" ]]; then
  echo "Missing fixture: $FIXTURE" >&2
  exit 1
fi
if [[ -z "${STAFF_EMAIL:-}" || -z "${STAFF_PASSWORD:-}" ]]; then
  echo "Set STAFF_EMAIL and STAFF_PASSWORD in the environment." >&2
  exit 1
fi

LOGIN_JSON="$(STAFF_EMAIL="$STAFF_EMAIL" STAFF_PASSWORD="$STAFF_PASSWORD" node -e "
  console.log(JSON.stringify({ email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD }));
")"

TOKEN="$(
  curl -s -X POST "${API_URL}/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_JSON" \
    | node -e "
      const fs = require('fs');
      const d = JSON.parse(fs.readFileSync(0, 'utf8'));
      if (!d.accessToken) { console.error(JSON.stringify(d)); process.exit(1); }
      process.stdout.write(d.accessToken);
    "
)"

BODY="$(node -e "
  const fs = require('fs');
  const rows = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  process.stdout.write(JSON.stringify({ rows }));
" "$FIXTURE")"

echo "POST ${API_URL}/pmes/admin/import-legacy-pioneers ..."
curl -s -X POST "${API_URL}/pmes/admin/import-legacy-pioneers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$BODY" | node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(j,null,2))"
