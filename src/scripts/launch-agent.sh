#!/usr/bin/env bash
set -euo pipefail

# Args
project_path="${1:-}"
prompt="${2:-}"
session_name="${3:-}"

if [[ -z "$project_path" || -z "$prompt" || -z "$session_name" ]]; then
  echo "Usage: $0 <project_path> <prompt> <session_name>" >&2
  exit 1
fi

# Start a detached tmux session with working directory set to project_path,
# and exec codex with proper argv (no manual string escaping needed).
tmux new-session -d -s "$session_name" -c "$project_path" \
  codex --dangerously-bypass-approvals-and-sandbox --cd="$project_path" "$prompt"

echo "OK: ${session_name}"