#!/usr/bin/env bash
# Fail fast before Vite/Pages or OpenNext deploy if the canonical API is misconfigured.
# Single source of truth: VITE_API_BASE_URL in .env.production must point at the live Worker /api base
# (same Neon as production). This does not replace DB migrations — it blocks obvious split-brain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PREFLIGHT_ENV_FILE:-$ROOT/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "preflight: missing $ENV_FILE" >&2
  exit 1
fi

# One VITE_API_BASE_URL line, last wins if duplicated (still wrong — human should fix file)
RAW="$(grep -E '^[[:space:]]*VITE_API_BASE_URL=' "$ENV_FILE" | tail -n1 || true)"
VAL="${RAW#*=}"
VAL="${VAL%$'\r'}"
VAL="${VAL#\"}"
VAL="${VAL%\"}"
VAL="${VAL#\'}"
VAL="${VAL%\'}"

BASE="${VAL//[[:space:]]/}"

if [[ -z "$BASE" ]]; then
  echo "preflight: VITE_API_BASE_URL is empty in $ENV_FILE" >&2
  exit 1
fi

if [[ "$BASE" == *"VITE_API_BASE_URL="* ]]; then
  echo "preflight: malformed VITE_API_BASE_URL (nested key — fix the line in $ENV_FILE)" >&2
  exit 1
fi

if [[ "${PREFLIGHT_ALLOW_LOCALHOST:-}" != "1" ]]; then
  case "$BASE" in
    *your-domain.com*|*example.com*|*127.0.0.1*|*localhost*)
      echo "preflight: VITE_API_BASE_URL looks like a placeholder or local URL: $BASE" >&2
      echo "preflight: set PREFLIGHT_ALLOW_LOCALHOST=1 only for intentional local checks." >&2
      exit 1
      ;;
  esac
fi

if [[ "${PREFLIGHT_ALLOW_HTTP:-}" != "1" && "$BASE" != https://* ]]; then
  echo "preflight: expected https VITE_API_BASE_URL (or set PREFLIGHT_ALLOW_HTTP=1)" >&2
  exit 1
fi

BASE="${BASE%/}"

HEALTH_URL="${BASE}/health"
# Known-missing login → must be 404 JSON, not 500 HTML
RESOLVE_URL="${BASE}/pmes/member/resolve-login-email?login=__preflight_check__"

echo "preflight: checking $BASE"

TMP_HEALTH="$(mktemp)"
TMP_RESOLVE="$(mktemp)"
trap 'rm -f "$TMP_HEALTH" "$TMP_RESOLVE"' EXIT

code_h="$(curl -sS -o "$TMP_HEALTH" -w '%{http_code}' "$HEALTH_URL" || echo "000")"
if [[ "$code_h" != "200" ]]; then
  echo "preflight: GET $HEALTH_URL expected 200, got $code_h" >&2
  cat "$TMP_HEALTH" >&2 || true
  exit 1
fi

if ! grep -q '"status"' "$TMP_HEALTH" || ! grep -qi 'ok\|connected' "$TMP_HEALTH"; then
  echo "preflight: unexpected health body:" >&2
  cat "$TMP_HEALTH" >&2
  exit 1
fi

code_r="$(curl -sS -o "$TMP_RESOLVE" -w '%{http_code}' "$RESOLVE_URL" || echo "000")"
if [[ "$code_r" != "404" && "$code_r" != "200" ]]; then
  echo "preflight: resolve-login expected 404 or 200, got $code_r" >&2
  cat "$TMP_RESOLVE" >&2
  exit 1
fi

ORIGIN="${PREFLIGHT_PAGES_ORIGIN:-https://preflight.invalid}"
code_o="$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS \
  "${BASE}/pmes/member/resolve-login-email?login=x" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type,authorization" || echo "000")"

if [[ "$code_o" != "204" && "$code_o" != "200" ]]; then
  echo "preflight: CORS OPTIONS expected 204 (or 200), got $code_o — Pages UI may fail cross-origin" >&2
  exit 1
fi

echo "preflight: OK (health + resolve + CORS preflight)"
