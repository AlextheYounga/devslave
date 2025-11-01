#!/usr/bin/env bash
set -euo pipefail

# Paths
scripts_dir="${AGENT_REPO}/src/scripts"
stubs_folder="${scripts_dir}/stubs"

setup_directory_structure() {
    mkdir -p src
    mkdir -p tests
}

setup_package_json() {
    if [[ ! -f package.json ]]; then
        npm init --init-author-name="Alex Younger" --yes
        npm install --save-dev jest
        npm install inquirer chalk
        echo "Created package.json"
    else
        echo "package.json already exists, skipping npm init"
    fi
}

setup_gitignore() {
    if [[ ! -f .gitignore ]]; then
        cp "${stubs_folder}/node-gitignore.txt" .gitignore || true
    else
        echo "Node.js gitignore rules already present, skipping"
    fi
}

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "build: add node setup" --no-gpg-sign || true
        echo "Committed Node.js setup changes"
    fi
}

run_node_functions() {
    # Node is already installed at the global level at v22. See Dockerfile.
    local codebase_path="$1"
    cd "$codebase_path" || exit 1

    setup_directory_structure
    setup_package_json
    setup_gitignore
    commit_changes
}
