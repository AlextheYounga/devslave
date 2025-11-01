#!/usr/bin/env bash

# Args
codebase_id=$1
agent_id=$2

if [[ -z "$codebase_id" || -z "$agent_id" ]]; then
    echo "Usage: $0 <codebase_id> <agent_id>" >&2
    exit 1
fi

get_codebase_path_by_id() {
    local codebase_id=$1
    local codebase_path

    sql="SELECT path FROM codebases WHERE id = '$codebase_id' LIMIT 1;"
    codebase_path=$(sqlite3 "$DB_ABSOLUTE_URL" "$sql")

    if [[ -z "$codebase_path" ]]; then
        echo "Error: Codebase with ID $codebase_id not found." >&2
        return 1
    fi

    echo "$codebase_path"
}

get_agent_prompt_by_id() {
    local agent_id=$1
    local prompt

    sql="SELECT prompt FROM agents WHERE id = '$agent_id' LIMIT 1;"
    prompt=$(sqlite3 "$DB_ABSOLUTE_URL" "$sql")

    if [[ -z "$prompt" ]]; then
        echo "Error: Agent with ID $agent_id not found." >&2
        return 1
    fi

    echo "$prompt"
}

# Database queries
codebase_path=$(get_codebase_path_by_id "$codebase_id")
prompt=$(get_agent_prompt_by_id "$agent_id")

# Run Codex
codex --dangerously-bypass-approvals-and-sandbox --cd="$codebase_path" "$prompt"
