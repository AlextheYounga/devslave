#!/usr/bin/env bash

# Args
codebase_id=$1
agent_id=$2

if [[ -z "$codebase_id" || -z "$agent_id" ]]; then
    echo "Usage: $0 <codebase_id> <agent_id>" >&2
    exit 1
fi

scripts_dir="${AGENT_REPOsrc/api/scriptsts"
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

get_agent_data_by_id() {
    local agent_id=$1
    local prompt

    sql="SELECT prompt, model FROM agents WHERE id = '$agent_id' LIMIT 1;"
    agent_data=$(db_query "$sql")

    if [[ -z "$agent_data" ]]; then
        echo "Error: Agent with ID $agent_id not found." >&2
        return 1
    fi

    echo "$agent_data"
}

# Database queries
codebase_path=$(get_codebase_path_by_id "$codebase_id")
agent_data=$(get_agent_data_by_id "$agent_id")
prompt=$(echo "$agent_data" | cut -d'|' -f1)
model=$(echo "$agent_data" | cut -d'|' -f2)
is_gpt_oss=false

# Detect if model string contains "gpt-oss"
if [[ -n "$model" && "$model" == *"gpt-oss"* ]]; then
    is_gpt_oss=true
fi

# Run Codex
if [[ "$is_gpt_oss" == true ]]; then
    # Run with OSS flag
    codex --oss --model="$model" --dangerously-bypass-approvals-and-sandbox --cd="$codebase_path" "$prompt"
elif [[ -n "$model" && "$model" != "default" ]]; then
    # Run with just specified model
    codex --model="$model" --dangerously-bypass-approvals-and-sandbox --cd="$codebase_path" "$prompt"
else
    # Run with default model
    codex --dangerously-bypass-approvals-and-sandbox --cd="$codebase_path" "$prompt"
fi
