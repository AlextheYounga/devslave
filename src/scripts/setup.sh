#!/usr/bin/env bash
set -euo pipefail

# Args
codebase_id=${1:-}

if [[ -z "${codebase_id}" ]]; then
  echo "Usage: $0 <codebase_id>" >&2
  exit 1
fi

get_codebase_by_id() {
    local codebase_id=$1
    local codebase_record
    
    sql="SELECT * FROM codebases WHERE id = '$codebase_id' LIMIT 1;"
    codebase_record=$(sqlite3 $DB_ABSOLUTE_URL "$sql")
    
    if [[ -z "$codebase_record" ]]; then
        echo "Error: Codebase with ID $codebase_id not found." >&2
        return 1
    fi
    
    echo "$codebase_record"
}

# Paths
scripts_dir="${AGENT_REPO}/src/scripts"
stubs_folder="${scripts_dir}/stubs"

# Source dependencies
source "${scripts_dir}/setup/setup_agent_folder.sh"
source "${scripts_dir}/setup/setup_precommit.sh"
source "${scripts_dir}/setup/setup_git.sh"
source "${scripts_dir}/setup/setup/node_functions.sh"
source "${scripts_dir}/setup/setup/python_functions.sh"

# Database queries
codebase=$(get_codebase_by_id "$codebase_id")
codebase_data=$(echo "$codebase" | cut -d'|' -f5)

# Handle NULL or empty data field by providing default JSON
if [[ -z "$codebase_data" || "$codebase_data" == "NULL" ]]; then
    codebase_data='{"setupType": "default", "masterPrompt": ""}'
fi

setup_type=$(echo "$codebase_data" | jq -r '.setupType // "default"')
master_prompt=$(echo "$codebase_data" | jq -r '.masterPrompt // ""')
codebase_path=$(echo "$codebase" | cut -d'|' -f3)

main() {
    setup_agent_folder
    setup_precommit
    git_init

    if [[ "${setup_type}" == "node" ]]; then
        run_node_functions
    elif [[ "${setup_type}" == "python" ]]; then
        run_python_functions
    else
        echo "Unknown setup type: ${setup_type}" >&2
        exit 1
    fi
    
    echo "Project setup completed successfully"
}

main

