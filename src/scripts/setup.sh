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
    codebase_record=$(sqlite3 "$DB_ABSOLUTE_URL" "$sql")

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
# shellcheck disable=SC1091
source "$scripts_dir/setup/git_init.sh"
# shellcheck disable=SC1091
source "$scripts_dir/setup/node_functions.sh"
# shellcheck disable=SC1091
source "$scripts_dir/setup/python_functions.sh"
# shellcheck disable=SC1091
source "$scripts_dir/setup/laravel_functions.sh"
# shellcheck disable=SC1091
source "$scripts_dir/setup/rust_functions.sh"
# shellcheck disable=SC1091
source "$scripts_dir/setup/vue_functions.sh"

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

run_language_specific_functions() {
    if [[ "${setup_type}" == "node" ]]; then
        run_node_functions "$codebase_path"
    elif [[ "${setup_type}" == "python" ]]; then
        run_python_functions "$codebase_path"
    elif [[ "${setup_type}" == "rust" ]]; then
        run_rust_functions "$codebase_path"
    elif [[ "${setup_type}" == "laravel" ]]; then
        run_laravel_functions "$codebase_path"
    elif [[ "${setup_type}" == "vue" ]]; then
        run_vue_functions "$codebase_path"
    else
        echo "No specific setup functions for setupType: ${setup_type}, skipping."
    fi
}

setup_project_directory() {
    # Set up agent folder
    mkdir -p "${codebase_path}"
    mkdir -p "${codebase_path}/docs"
    mkdir -p "${codebase_path}/${AGENT_FOLDER_NAME}/tickets"

    # Create PROJECT.md with master prompt
    touch "${codebase_path}/${AGENT_FOLDER_NAME}/PROJECT.md"
    echo "$master_prompt" > "${codebase_path}/${AGENT_FOLDER_NAME}/PROJECT.md"

    prompts_dir="${AGENT_REPO}/src/prompts"
    cp -R "${prompts_dir}/." "${codebase_path}/${AGENT_FOLDER_NAME}/" || true
}

setup_precommit() {
    # Add pre-commit config (no network; install only if pre-commit exists)
    cp "${stubs_folder}/precommitconfig.yaml" "${codebase_path}/.pre-commit-config.yaml" || true

    if command -v pre-commit > /dev/null 2>&1; then
        pre-commit install || true
    fi
}

main() {
    # Set up codebase directory
    mkdir -p "${codebase_path}"
    cd "$codebase_path" || exit 1

    setup_project_directory
    git_init "$codebase_path"
    run_language_specific_functions

    # Move to project folder
    setup_precommit

    echo "Project setup completed successfully"
}

main
