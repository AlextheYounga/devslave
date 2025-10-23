#!/usr/bin/env bash
set -euo pipefail

codebase_id=$1
branch_name=$2

get_codebase_path_by_id() {
    local codebase_id=$1
    local codebase_path
    
    sql="SELECT path FROM codebases WHERE id = '$codebase_id' LIMIT 1;"
    codebase_path=$(sqlite3 "$DB_ABSOLUTE_URL" "$sql")
    
    if [[ -z "$codebase_path" ]]; then
        echo "Error: Codebase with ID $codebase_id not found." >&2
        return 1
    fi
    
    echo "$codebase_path"
}

git_commit() {
    local codebase_path=$1
    local message=$2

    git config user.name "$GIT_USERNAME"
    git config user.email "$GIT_EMAIL"
    git config commit.gpgsign false
    git add .
    message="chore: auto-commit on branch $branch_name before creating new branch"
    git commit -m "$message" --no-gpg-sign
}

codebase_path=$(get_codebase_path_by_id "$codebase_id")
cd "$codebase_path"

#If already on branch, exit
current_branch=$(git symbolic-ref --short HEAD)
if [[ "$current_branch" == "$branch_name" ]]; then
    echo "Already on branch $branch_name"
    exit 0
fi

# If there are any changes (staged or unstaged), commit them before creating new branch
if ! git diff --quiet || ! git diff --cached --quiet; then
    message="chore: auto-commit on branch $branch_name before creating new branch"
    git_commit "$codebase_id" "$message"
fi

git config user.name "$GIT_USERNAME"
git config user.email "$GIT_EMAIL"
git config commit.gpgsign false
main_trunk=$(git symbolic-ref HEAD | sed 's/refs\/heads\///')
git checkout -b "$branch_name" "$main_trunk"
