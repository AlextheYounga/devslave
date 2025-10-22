#!/usr/bin/env bash
set -euo pipefail

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "build: add vue setup" --no-gpg-sign || true
    fi
}


run_vue_functions() {
    local codebase_path="$1"
    cd "$codebase_path" || exit 1
    cd ..
    folder_name=$(basename "$codebase_path")

    if [[ ! -d "$folder_name" ]]; then
        npm create vue@latest "$folder_name" -- --ts --vue-router --playwright --eslint --prettier
        cd "$folder_name"
        npm install
        npm install tailwindcss @tailwindcss/vite
        npm install --save-dev jest
    else
        echo "Laravel project $folder_name already exists, skipping"
    fi

    cd "$folder_name" || exit 1
    commit_changes
}