#!/usr/bin/env bash
# Point this repo at .githooks/ so post-commit auto-push runs after each commit.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath "$ROOT/.githooks"
chmod +x "$ROOT/.githooks/post-commit" 2>/dev/null || true
echo "core.hooksPath set to $ROOT/.githooks"
echo "Commits will run: git push (or git push -u on first push)."
echo "To disable: git config --unset core.hooksPath"
