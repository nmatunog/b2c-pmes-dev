#!/usr/bin/env bash
# Repeatable pre-push checks: backend tests + typecheck, frontend lint + typecheck + Next build.
# Optional: VERIFY_SKIP_NEXT_BUILD=1 for faster runs (skip `next build`).
# Optional: VERIFY_PREFLIGHT=1 to also run production API preflight (network; same as deploy gate).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  B2C-PMES debug-verify (run after code changes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "==> backend: npm test"
(cd "$ROOT/backend" && npm test)

echo ""
echo "==> backend: tsc --noEmit"
(cd "$ROOT/backend" && npx tsc --noEmit)

echo ""
echo "==> frontend: npm run lint"
(cd "$ROOT/frontend" && npm run lint)

echo ""
echo "==> frontend: tsc --noEmit"
(cd "$ROOT/frontend" && npx tsc --noEmit)

if [[ "${VERIFY_SKIP_NEXT_BUILD:-}" == "1" ]]; then
  echo ""
  echo "==> frontend: next build (skipped — VERIFY_SKIP_NEXT_BUILD=1)"
else
  echo ""
  echo "==> frontend: npm run build (Next.js)"
  (cd "$ROOT/frontend" && npm run build)
fi

if [[ "${VERIFY_PREFLIGHT:-}" == "1" ]]; then
  echo ""
  echo "==> frontend: preflight:api (production URL from .env.production)"
  (cd "$ROOT/frontend" && npm run preflight:api)
else
  echo ""
  echo "Tip: VERIFY_PREFLIGHT=1 bash scripts/debug-verify.sh  — hit live /api health + CORS check"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  debug-verify: OK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
