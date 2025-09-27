#!/usr/bin/env bash
set -euo pipefail

# Args
project_path="${1:-}"
if [[ -z "${project_path}" ]]; then
  echo "Usage: $0 <project_path>" >&2
  exit 1
fi

# Resolve repo root (this script lives in src/scripts/setup)
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

mkdir -p "${project_path}"

# Set up agent folder
mkdir -p "${project_path}/docs"
mkdir -p "${project_path}/codex/tickets"

prompts_dir="${repo_root}/src/prompts"
cp -R "${prompts_dir}/prompts/" "${project_path}/codex/" || true

# Move to project folder
cd "${project_path}"

# Add pre-commit config (no network; install only if pre-commit exists)
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.2
    hooks:
      - id: gitleaks
EOF

if command -v pre-commit >/dev/null 2>&1; then
  pre-commit install || true
fi

# Setup Git (force master as default branch)
git -c init.defaultBranch=master init
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"
git config commit.gpgsign false

git add -A
git commit -m "initial commit" --no-gpg-sign || true

echo "ok"