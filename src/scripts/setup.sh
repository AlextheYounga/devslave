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
source "${scripts_dir}/setup/git_init.sh"
source "${scripts_dir}/setup/setup/node_functions.sh"
source "${scripts_dir}/setup/setup/python_functions.sh"

# Database queries
codebase=$(get_codebase_by_id "$codebase_id")
codebase_data=$(echo "$codebase" | cut -d'|' -f4)
setup_type=$(echo "$codebase_data" | jq -r '.setupType // "default"')
master_prompt=$(echo "$codebase_data" | jq -r '.masterPrompt // ""')
codebase_path=$(echo "$codebase" | cut -d'|' -f3)

setup_agent_folder() {
    # Set up agent folder
    mkdir -p "${codebase_path}"
    mkdir -p "${codebase_path}/docs"
    mkdir -p "${codebase_path}/${AGENT_FOLDER}/tickets"
    mkdir -p "${codebase_path}/${AGENT_FOLDER}/scripts"

    # Create PROJECT.md with master prompt
    touch "${codebase_path}/${AGENT_FOLDER}/PROJECT.md"
    cat master_prompt > "${codebase_path}/${AGENT_FOLDER}/PROJECT.md"

    prompts_dir="${AGENT_REPO}/src/prompts"
    cp -R "${prompts_dir}/." "${codebase_path}/${AGENT_FOLDER}/" || true

    # Adding scripts (if directory exists)
    if [[ -d "${AGENT_REPO}/src/scripts/agent" ]]; then
        cp -R "${AGENT_REPO}/src/scripts/agent/." "${codebase_path}/${AGENT_FOLDER}/scripts"
    fi
}

setup_precommit() {
    # Add pre-commit config (no network; install only if pre-commit exists)
    cp "${stubs_folder}/precommitconfig.yaml" "${codebase_path}/.pre-commit-config.yaml" || true

    # Move to project folder
    cd "${codebase_path}"

    if command -v pre-commit >/dev/null 2>&1; then
        pre-commit install || true
    fi
}

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
}

main

