#!/usr/bin/env bash
set -euo pipefail

# Args
codebase_id=$1
agent_id=$2

if [[ -z "$codebase_id" || -z "$agent_id" ]]; then
    echo "Usage: $0 <codebase_id> <agent_id>" >&2
    exit 1
fi

scripts_dir="${AGENT_REPO}/src/scripts"
# shellcheck disable=SC1091
source "${scripts_dir}/lib/db.sh"

get_codebase_path_by_id() {
    local codebase_id=$1
    local codebase_path

    sql="SELECT path FROM codebases WHERE id = '$codebase_id' LIMIT 1;"
    codebase_path=$(db_query "$sql")

    if [[ -z "$codebase_path" ]]; then
        echo "Error: Codebase with ID $codebase_id not found." >&2
        return 1
    fi

    echo "$codebase_path"
}

get_tmux_session_by_agent_id() {
    local agent_id=$1
    local tmux_session_name

    sql="SELECT \"tmuxSession\" FROM agents WHERE id = '$agent_id' LIMIT 1;"
    tmux_session_name=$(db_query "$sql")

    if [[ -z "$tmux_session_name" ]]; then
        echo "Error: Agent with ID $agent_id not found." >&2
        return 1
    fi

    echo "$tmux_session_name"
}

# Database queries
codebase_path=$(get_codebase_path_by_id "$codebase_id")
session_name=$(get_tmux_session_by_agent_id "$agent_id")

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
