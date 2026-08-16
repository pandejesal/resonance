#!/usr/bin/env bash
# Reset the Resonance demo server to a clean slate.
#   - stops the container
#   - wipes the data volume (accounts, licenses, scan state)
#   - starts fresh and waits for the health endpoint
#
# Usage:  ./demo-reset.sh            (from repo root)
#         docker compose -f docker/demo-compose.yml up -d   (after reset)
set -euo pipefail

COMPOSE="docker compose -f docker/demo-compose.yml"

echo "==> Stopping demo container..."
$COMPOSE down || true

echo "==> Removing data volume (fresh demo state)..."
docker volume rm resonance-demo-data || true

echo "==> Starting fresh demo..."
$COMPOSE up -d --build

echo "==> Waiting for health endpoint..."
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "==> Demo is up: http://localhost:8080"
    echo "==> Next: create the admin account (or run the auto-login setup),"
    echo "==>       then trigger a library scan in Settings."
    exit 0
  fi
  sleep 2
done

echo "ERROR: demo did not become healthy within 120s" >&2
exit 1