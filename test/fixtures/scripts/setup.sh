#!/usr/bin/env bash
set -euo pipefail

# Args
codebase_id=${1:-}

if [[ -z "${codebase_id}" ]]; then
    echo "Usage: $0 <codebase_id>" >&2
    exit 1
fi

scripts_dir="${API_REPO}/src/api/scripts"
# shellcheck disable=SC1091
source "${scripts_dir}/lib/db.sh"

get_codebase_by_id() {
    local codebase_id=$1
    local codebase_record

    sql="SELECT * FROM codebases WHERE id = '$codebase_id' LIMIT 1;"
    codebase_record=$(db_query "$sql")

    if [[ -z "$codebase_record" ]]; then
        echo "Error: Codebase with ID $codebase_id not found." >&2
        return 1
    fi

    echo "$codebase_record"
}

# Database queries
codebase=$(get_codebase_by_id "$codebase_id")
codebase_data=$(echo "$codebase" | cut -d'|' -f5)

# Handle NULL or empty data field by providing default JSON
if [[ -z "$codebase_data" || "$codebase_data" == "NULL" ]]; then
    codebase_data='{"setupType": "test", "masterPrompt": ""}'
fi

setup_type=$(echo "$codebase_data" | jq -r '.setupType // "test"')
master_prompt=$(echo "$codebase_data" | jq -r '.masterPrompt // ""')
project_path=$(echo "$codebase" | cut -d'|' -f3)

echo "Setting up ${setup_type} project at: ${project_path}"

# Mock function for test setup
setup_AGENT_FOLDER_NAME() {
    mkdir -p "${project_path}"
    mkdir -p "${project_path}/docs"
    mkdir -p "${project_path}/${AGENT_FOLDER_NAME}/tickets"
    mkdir -p "${project_path}/${AGENT_FOLDER_NAME}/scripts"

    # Create PROJECT.md with master prompt content (using printf to avoid trailing newline)
    printf "%s" "${master_prompt}" > "${project_path}/${AGENT_FOLDER_NAME}/PROJECT.md"

    # Create a mock git_commit.sh script that doesn't actually commit
    cat > "${project_path}/${AGENT_FOLDER_NAME}/scripts/git_commit.sh" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
commit_message="${1:-Auto commit}"
echo "Mock commit: ${commit_message}"
EOF

    chmod +x "${project_path}/${AGENT_FOLDER_NAME}/scripts/git_commit.sh"
}

main() {
    if [[ "${setup_type}" == "failing" ]]; then
        echo "Simulating failure for test purposes" >&2
        exit 1
    fi

    setup_AGENT_FOLDER_NAME

    if [[ "${setup_type}" == "node" ]]; then
        echo "Running node setup functions"
    elif [[ "${setup_type}" == "python" ]]; then
        echo "Running python setup functions"
    elif [[ "${setup_type}" == "test" ]]; then
        echo "Running test setup functions"
    else
        echo "Unknown setup type: ${setup_type}" >&2
        exit 1
    fi

    echo "Project setup completed successfully"
}

main
