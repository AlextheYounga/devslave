#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] working dir: $(pwd)"

# Ensure SSH is available (start in background)
echo "[entrypoint] starting sshd"
service ssh start

# One-time seed for Codex auth into named volume
if [ -d "/seed/.codex" ]; then
  if [ ! -d "/root/.codex" ] || [ -z "$(ls -A /root/.codex 2>/dev/null || true)" ]; then
    echo "[entrypoint] seeding /root/.codex from /seed/.codex"
    mkdir -p /root/.codex
    # Preserve perms and attributes
    cp -a /seed/.codex/. /root/.codex/

    # Reset codex history
    rm -rf /root/.codex/sessions/**
    truncate -s 0 /root/.codex/history.jsonl
  else
    echo "[entrypoint] /root/.codex already initialized; skipping seed"
  fi
else
  echo "[entrypoint] no /seed/.codex present; skipping seed"
fi

# Ensure dependencies are installed (named volume may override image node_modules)
if [ ! -d node_modules ] || [ ! -d node_modules/@prisma/client ]; then
  echo "[entrypoint] installing node dependencies (node_modules missing)"
  npm install --no-audit --no-fund
fi

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] prisma generate"
npx prisma generate

echo "[entrypoint] giving codex script -x permission"
chmod +x /app/agent/src/scripts/launch-agent.sh

echo "[entrypoint] starting app"
exec npm run server