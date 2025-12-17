#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/init-latest.sh [conservative|aggressive]
MODE="${1:-aggressive}"

echo "[init-latest] Installing workspace..."
pnpm -w install

if [ "$MODE" = "conservative" ]; then
  echo "[init-latest] Upgrading within semver ranges (conservative)..."
  pnpm -w up -Lri
else
  echo "[init-latest] Bumping all dependencies to latest (aggressive)..."
  pnpm dlx npm-check-updates -u --workspaces --root
fi

echo "[init-latest] Re-installing to regenerate lockfiles..."
pnpm -w install

echo "[init-latest] Ensuring env files..."
mkdir -p apps/api apps/web

if [ ! -f "apps/api/.env" ]; then
  cat > apps/api/.env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salespro_dev
PORT=4000
NODE_ENV=development
SESSION_SECRET=dev-session-secret-change-in-production
EOF
  echo "[init-latest] Created apps/api/.env"
else
  echo "[init-latest] apps/api/.env exists; leaving unchanged."
fi

if [ ! -f "apps/web/.env" ]; then
  cat > apps/web/.env <<'EOF'
VITE_API_BASE=http://localhost:4000/api
EOF
  echo "[init-latest] Created apps/web/.env"
else
  echo "[init-latest] apps/web/.env exists; leaving unchanged."
fi

echo "[init-latest] Running checks..."
pnpm -w lint
pnpm -w typecheck
pnpm -w test

echo "[init-latest] Done. Review changes and commit."


