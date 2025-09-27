#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] working dir: $(pwd)"

# Ensure SSH is available (start in background)
echo "[entrypoint] starting sshd"
service ssh start

# Ensure dependencies are installed (named volume may override image node_modules)
if [ ! -d node_modules ] || [ ! -d node_modules/@prisma/client ]; then
  echo "[entrypoint] installing node dependencies (node_modules missing)"
  npm install --no-audit --no-fund
fi

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] prisma generate"
npx prisma generate

echo "[entrypoint] starting app"
exec npm run server
