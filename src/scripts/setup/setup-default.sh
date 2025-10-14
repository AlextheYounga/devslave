#!/usr/bin/env bash
set -euo pipefail

# Args
project_path=$1
agent_folder="agent"

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
mkdir -p "${project_path}/${agent_folder}/tickets"
mkdir -p "${project_path}/${agent_folder}/scripts"

prompts_dir="${repo_root}/src/prompts"
cp -R "${prompts_dir}/." "${project_path}/${agent_folder}/" || true
cp "${repo_root}/src/scripts/git_commit.sh" "${project_path}/${agent_folder}/scripts/git_commit.sh"

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

# Setup Git (only if not already initialized)
if [[ ! -d ".git" ]]; then
  git -c init.defaultBranch=master init
  echo "Initialized new git repository"
else
  echo "Git repository already exists, skipping init"
fi

# Set git config only if not already configured
if [[ -z "$(git config --get user.name 2>/dev/null || true)" ]]; then
  git config user.name "Alex Younger Agent"
  echo "Set git user.name"
fi

if [[ -z "$(git config --get user.email 2>/dev/null || true)" ]]; then
  git config user.email "thealexyounger@proton.me"
  echo "Set git user.email"
fi

if [[ -z "$(git config --get commit.gpgsign 2>/dev/null || true)" ]]; then
  git config commit.gpgsign false
  echo "Disabled GPG signing"
fi

# Add and commit files (only if there are changes)
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  # Check if this is the first commit
  if git rev-parse HEAD >/dev/null 2>&1; then
    git commit -m "agent setup: add prompts and scripts" --no-gpg-sign || true
  else
    git commit -m "initial commit" --no-gpg-sign || true
  fi
fi

echo "ok"