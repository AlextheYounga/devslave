#!/usr/bin/env bash
set -euo pipefail
source ~/.nvm/nvm.sh

echo "[entrypoint] working dir: $(pwd)"

# Ensure SSH is available (start in background)
echo "[entrypoint] starting sshd"
service ssh start

echo "[entrypoint] installing npm dependencies"
nvm install
npm install --no-audit --no-fund

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

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] prisma generate"
npx prisma generate

echo "[entrypoint] giving codex script -x permission"
chmod +x /app/agent/src/scripts/launch-agent.sh

echo "[entrypoint] starting app"
exec npm run server