#!/usr/bin/env bash
# Start Postgres (Docker), apply migrations, smoke-check API. Requires Docker Desktop running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

compose_up() {
  if docker compose version &>/dev/null; then
    docker compose up -d
  elif command -v docker-compose &>/dev/null; then
    docker-compose up -d
  else
    echo "ERROR: Neither 'docker compose' nor 'docker-compose' is available."
    echo "Install Docker Desktop (https://www.docker.com/products/docker-desktop/) and ensure it is running."
    exit 1
  fi
}

echo "==> Starting Postgres (Docker Compose)"
compose_up

echo "==> Waiting for Postgres (5s)"
sleep 5

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> prisma generate"
npx prisma generate

echo ""
echo "OK. Start the API in another terminal:"
echo "  cd backend && npm run dev"
echo "Then:"
echo "  curl -sSf http://localhost:3000/health"
echo ""
