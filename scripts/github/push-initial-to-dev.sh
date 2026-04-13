#!/usr/bin/env bash
# One-time: after creating an EMPTY dev repo on GitHub, push this repo's branches/tags to it.
# Create the repo in the GitHub UI: New repository → name e.g. B2C-PMES-dev → no README/license.
#
# Usage:
#   bash scripts/github/push-initial-to-dev.sh
#   DEV_REMOTE_URL=https://github.com/ORG/B2C-PMES-dev.git bash scripts/github/push-initial-to-dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=defaults.sh
source "$(dirname "$0")/defaults.sh"

DEV_URL="${1:-$DEV_REMOTE_URL}"
REMOTE_NAME="${GIT_DEV_REMOTE_NAME:-dev}"

if [[ -z "$DEV_URL" ]]; then
  echo "Set DEV_REMOTE_URL or pass the dev clone URL as the first argument." >&2
  exit 1
fi

# Fail fast with a clear message (same as git push when repo was never created on GitHub).
if ! git ls-remote "$DEV_URL" &>/dev/null; then
  echo "" >&2
  echo "Cannot access: $DEV_URL" >&2
  echo "GitHub returns this when the repo does not exist yet, the URL is wrong, or you have no access." >&2
  echo "" >&2
  echo "Do this first:" >&2
  echo "  1. Open https://github.com/new (logged into the same account that owns your production repo)." >&2
  echo "  2. Repository name: e.g. B2C-PMES-dev — leave it EMPTY (no README, no .gitignore, no license)." >&2
  echo "  3. Create repository, then run this script again." >&2
  echo "" >&2
  echo "If the repo lives under another owner or name, set the URL explicitly, e.g.:" >&2
  echo "  git remote remove $REMOTE_NAME 2>/dev/null || true" >&2
  echo "  DEV_REMOTE_URL='https://github.com/OWNER/REPO.git' bash scripts/github/push-initial-to-dev.sh" >&2
  echo "" >&2
  exit 1
fi

if git remote get-url "$REMOTE_NAME" &>/dev/null; then
  echo "Remote '$REMOTE_NAME' already exists ($(git remote get-url "$REMOTE_NAME"))."
else
  git remote add "$REMOTE_NAME" "$DEV_URL"
  echo "Added remote $REMOTE_NAME -> $DEV_URL"
fi

echo "Pushing branches and tags to $REMOTE_NAME (dev)..."
git push "$REMOTE_NAME" --all
git push "$REMOTE_NAME" --tags
echo "Done. Next (once): bash scripts/github/switch-origin-to-dev.sh"
