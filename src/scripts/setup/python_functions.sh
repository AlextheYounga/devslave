#!/usr/bin/env bash
set -euo pipefail

# Paths
scripts_dir="${AGENT_REPO}/src/scripts"
stubs_folder="${scripts_dir}/stubs"

setup_uv() {
    # Setup uv
    if [[ ! -f "pyproject.toml" ]]; then
        uv init
    fi

    uv python install 3.13

    if [[ ! -d ".venv" ]]; then
        uv venv .venv
    fi
}

setup_pip() {
    # Create requirements.txt
    if [[ ! -f "requirements.txt" ]]; then
        cp "${stubs_folder}/requirements.txt" requirements.txt || true
    else
        echo "requirements.txt already exists, skipping"
    fi

    uv pip install -r requirements.txt
}

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "build: add python setup" --no-gpg-sign || true
    fi
}

run_python_functions() {
    local codebase_path="$1"
    cd "$codebase_path" || exit 1
    setup_uv
    setup_pip
    setup_gitignore
    commit_changes
}
