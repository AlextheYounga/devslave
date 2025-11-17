#!/usr/bin/env bash
set -euo pipefail

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "build: add rust setup" --no-gpg-sign || true
    fi
}

run_rust_functions() {
    local codebase_path="$1"
    cd "$codebase_path" || exit 1
    cd ..
    folder_name=$(basename "$codebase_path")

    if [[ ! -d "$folder_name" ]]; then
        cargo new "$folder_name"
    else
        echo "Rust project $folder_name already exists, skipping"
    fi

    cd "$folder_name" || exit 1
    commit_changes
}
