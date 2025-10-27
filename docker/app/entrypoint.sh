#!/usr/bin/env bash
set -euo pipefail
source ~/.nvm/nvm.sh

echo "[entrypoint] working dir: $(pwd)"

# Set up environment variables at runtime
source /usr/local/bin/setup-env.sh
setup_environment_variables

# Ensure SSH is available (start in background)
echo "[entrypoint] starting sshd"
service ssh start

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] prisma generate"
npx prisma generate

echo "[entrypoint] giving codex script -x permission"
chmod +x /app/agent/src/scripts/launch-agent.sh

echo "[entrypoint] starting app"
exec npm run server