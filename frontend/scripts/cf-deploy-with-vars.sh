#!/usr/bin/env bash
set -euo pipefail

# Load local non-secret values (do not put secrets here)
# Example file: frontend/.env.cloudflare.vars
if [[ -f ".env.cloudflare.vars" ]]; then
  set -a
  source ".env.cloudflare.vars"
  set +a
fi

# Required non-secret vars
VARS=(
  FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
)

ARGS=()
for k in "${VARS[@]}"; do
  v="${!k-}"
  if [[ -z "$v" ]]; then
    echo "Missing var: $k" >&2
    exit 1
  fi
  ARGS+=(--var "$k:$v")
done

npm run preflight:api
npm run cf:build
npx wrangler deploy --config wrangler.jsonc --keep-vars "${ARGS[@]}"
