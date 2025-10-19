#!/usr/bin/env bash

# Args
project_path="${1:-}"
session_name="${2:-}"
prompt="${3:-}"

if [[ -z "$project_path" || -z "$prompt" || -z "$session_name" ]]; then
  echo "Usage: $0 <project_path> <prompt> <session_name>" >&2
  exit 1
fi

# Start a detached tmux session with working directory set to project_path,
# and exec codex with proper argv (no manual string escaping needed).
tmux new-session -d -s "$session_name" -c "$project_path" \
  /root/.nvm/versions/node/v22.20.0/bin/codex \
   --dangerously-bypass-approvals-and-sandbox --cd="$project_path" "$prompt"

# Get tmux pane status
tmux_status=$(tmux list-panes -t "$session_name" -F "#{pane_active}:#{pane_pid}" | head -n 1)

echo "OK: ${tmux_status}"