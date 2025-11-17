#!/usr/bin/env bash

# Args
codebase_id=$1

env_file="$AGENT_REPO/.env"
if [[ -f "$AGENT_REPO/.env.docker" ]]; then
    env_file="$AGENT_REPO/.env.docker"
fi

# shellcheck disable=SC1090
source "$env_file"

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

codebase_path=$(get_codebase_path_by_id "$codebase_id")

if [[ -z "$codebase_path" ]]; then
    echo "Error: Failed to retrieve codebase path." >&2
    exit 1
fi

if [[ ! -d "$codebase_path" ]]; then
    echo "Error: Codebase path does not exist: $codebase_path" >&2
    exit 1
fi

# Get the base directory name
codebase_name=$(basename "$codebase_path")

# Create zip filename with datetime
zip_filename="${codebase_name}.zip"
zip_path="/tmp/agent_cache/$zip_filename"

# Zip the directory without including full path
# Using -r for recursive and changing to parent directory
parent_dir=$(dirname "$codebase_path")
cd "$parent_dir" || exit 1

if zip -r "$zip_path" "$codebase_name" > /dev/null; then
    echo "$zip_path"
    exit 0
else
    echo "Error: Failed to create zip archive." >&2
    exit 1
fi
