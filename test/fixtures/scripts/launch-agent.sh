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

# Use a deterministic UUID-looking value so tests can assert extraction
session_id="123e4567-e89b-12d3-a456-426614174000"

# Start a detached tmux session with working directory set to project_path
# We intentionally spawn a child process (tail -f) that keeps a file under /tmp/sessions/* open,
# so that `lsof -p <childPid> | grep sessions` returns a path including the session_id.
tmux new-session -d -s "$session_name" -c "$project_path" \
  bash -lc "mkdir -p /tmp/sessions; touch /tmp/sessions/${session_id}.jsonl; tail -f /tmp/sessions/${session_id}.jsonl & wait"

echo "OK: ${session_name}"