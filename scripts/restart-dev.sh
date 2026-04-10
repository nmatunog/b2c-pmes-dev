#!/usr/bin/env bash
# Stop whatever is listening on the API and Vite ports, then start backend + frontend together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping listener(s) on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
  fi
}

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo "Starting backend (port $BACKEND_PORT) and frontend (port $FRONTEND_PORT)..."
echo "Press Ctrl+C to stop both."
echo ""

(cd "$ROOT/backend" && npm run dev) &
BACK_PID=$!

(cd "$ROOT/frontend" && npm run dev) &
FRONT_PID=$!

wait
