#!/usr/bin/env bash
set -euo pipefail

project_path="${1:-}"
if [[ -z "${project_path}" ]]; then
  echo "Usage: $0 <project_path>" >&2
  exit 1
fi

echo "Setting up test project at: ${project_path}"

mkdir -p "${project_path}/codex/tickets"
mkdir -p "${project_path}/codex/templates"
touch "${project_path}/codex/PROJECT.md"

cd "${project_path}"
git -c init.defaultBranch=master init -q
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git add -A
git commit -q -m "initial commit" --no-gpg-sign || true

echo "Project setup completed successfully"