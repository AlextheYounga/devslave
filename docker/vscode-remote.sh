#!/bin/bash

set -euo pipefail

# Check if container is running
container_name=$(docker ps --filter "name=devslave-app" --format "{{.Names}}")

if [ -z "$container_name" ]; then
    echo "❌ Error: devslave-app container is not running"
    exit 1
fi

echo "📦 Container: $container_name"

## VS Code profile selection (defaults to 'Default')
VSCODE_PROFILE=${VSCODE_PROFILE:-Default}
echo "🧩 VS Code profile: ${VSCODE_PROFILE}"

HOST_ALIAS="devslave-container"
HOSTNAME="localhost"

echo "📂 Opening /app/dev in VS Code via Remote-SSH..."
# Some versions of 'code' don't support --folder-uri in help text but still accept it; add a fallback.
code --profile "${VSCODE_PROFILE}" --folder-uri "vscode-remote://ssh-remote+${HOST_ALIAS}/app/dev" \
    || code --profile "${VSCODE_PROFILE}" "vscode-remote://ssh-remote+${HOST_ALIAS}/app/dev"
