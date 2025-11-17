#!/usr/bin/env bash
# Assume we are on the feature branch to be completed
set -euo pipefail

env_file="$API_REPO/.env"
if [[ -f "$API_REPO/.env.docker" ]]; then
    env_file="$API_REPO/.env.docker"
fi

# shellcheck disable=SC1090
source "$env_file"

scripts_dir="${API_REPO}/src/scripts"
# shellcheck disable=SC1091
source "${scripts_dir}/lib/db.sh"

codebase_id=$1

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

git_commit() {
    local codebase_path=$1
    local message=$2

    git config user.name "$GIT_USERNAME"
    git config user.email "$GIT_EMAIL"
    git config commit.gpgsign false
    git add .
    git commit -m "$message" --no-gpg-sign
}

codebase_path=$(get_codebase_path_by_id "$codebase_id")
cd "$codebase_path"

# Get the current branch and determine main trunk
if ! current_branch=$(git symbolic-ref --short HEAD 2> /dev/null); then
    echo "Error: Repository is in detached HEAD state. Please checkout a branch first." >&2
    exit 1
fi

echo "Current branch: $current_branch"
echo "Main trunk: $GIT_DEFAULT_BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
    message="chore: auto-commit before completing feature $current_branch"
    git_commit "$codebase_path" "$message"
fi

git config user.name "$GIT_USERNAME"
git config user.email "$GIT_EMAIL"
git config commit.gpgsign false

# Verify we're not already on the main trunk
if [[ "$current_branch" == "$GIT_DEFAULT_BRANCH" ]]; then
    echo "Error: Already on main trunk branch ($GIT_DEFAULT_BRANCH). Cannot complete feature from main branch." >&2
    exit 1
fi

echo "Completing feature branch '$current_branch' by rebasing onto '$GIT_DEFAULT_BRANCH'..."

# Rebase feature branch onto main trunk
echo "Rebasing '$current_branch' onto '$GIT_DEFAULT_BRANCH'..."
if ! git rebase "$GIT_DEFAULT_BRANCH"; then
    echo "Error: Rebase failed. Please resolve conflicts manually and run 'git rebase --continue'" >&2
    echo "Or run 'git rebase --abort' to cancel the rebase." >&2
    exit 1
fi

# Switch back to main trunk
echo "Switching to $GIT_DEFAULT_BRANCH for fast-forward merge..."
git checkout "$GIT_DEFAULT_BRANCH"

# Fast-forward merge the rebased feature branch
echo "Fast-forward merging '$current_branch' into '$GIT_DEFAULT_BRANCH'..."
if ! git merge --ff-only "$current_branch"; then
    echo "Error: Fast-forward merge failed. This shouldn't happen after a successful rebase." >&2
    exit 1
fi

echo "Feature branch '$current_branch' has been successfully completed and merged into '$GIT_DEFAULT_BRANCH'!"
echo "Current branch is now '$GIT_DEFAULT_BRANCH' with a clean, linear history."
