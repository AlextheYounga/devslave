#!/usr/bin/env bash
set -euo pipefail

# Args
project_path="${1:-}"
session_name="${2:-}"
prompt="${3:-}"

if [[ -z "$project_path" || -z "$prompt" || -z "$session_name" ]]; then
  echo "Usage: $0 <project_path> <prompt> <session_name>" >&2
  exit 1
fi

# Use a deterministic UUID-looking value so tests can assert extraction
session_id="123e4567-e89b-12d3-a456-426614174000"

# Create a deterministic session file in a nested date path and exit; no tmux needed in tests
year=$(date +%Y)
month=$(date +%m)
day=$(date +%d)
timestamp=$(date +%Y-%m-%dT%H-%M-%S)
dir="$HOME/.codex/sessions/${year}/${month}/${day}"
mkdir -p "$dir"
touch "$dir/rollout-${timestamp}-${session_id}.jsonl"

echo "OK: ${session_name}"