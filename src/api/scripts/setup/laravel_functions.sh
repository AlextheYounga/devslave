#!/usr/bin/env bash
set -euo pipefail

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "build: add laravel setup" --no-gpg-sign || true
    fi
}

run_laravel_functions() {
    local codebase_path="$1"
    cd "$codebase_path" || exit 1
    cd ..
    folder_name=$(basename "$codebase_path")

    if [[ ! -d "$folder_name" ]]; then
        laravel new "$folder_name" --using=laravel/vue-starter-kit --phpunit --no-interaction
        cd "$folder_name"
    else
        echo "Laravel project $folder_name already exists, skipping"
    fi

    cd "$folder_name" || exit 1
    commit_changes
}
