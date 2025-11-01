#!/bin/bash
set -euo pipefail

# Setup Git (only if not already initialized)
git_init() {
    local codebase_path="$1"
    cd "$codebase_path" || exit 1
    
    git -c init.defaultBranch="$GIT_DEFAULT_BRANCH" init

    # Set git config only if not already configured
    if [[ -z "$(git config --get user.name 2>/dev/null || true)" ]]; then
        git config user.name "$GIT_USERNAME"
        echo "Set git user.name"
    fi

    if [[ -z "$(git config --get user.email 2>/dev/null || true)" ]]; then
        git config user.email "$GIT_EMAIL"
        echo "Set git user.email"
    fi

    if [[ -z "$(git config --get commit.gpgsign 2>/dev/null || true)" ]]; then
        git config commit.gpgsign false
        echo "Disabled GPG signing"
    fi

    # Add and commit files (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        # Check if this is the first commit
        if git rev-parse HEAD >/dev/null 2>&1; then
            git commit -m "agent setup: add prompts and scripts" --no-gpg-sign || true
        else
            git commit -m "initial commit" --no-gpg-sign || true
        fi
    fi

    # Create a develop branch if it doesn't exist
    if ! git show-ref --verify --quiet "refs/heads/develop"; then
        git checkout -b develop
        echo "Created 'develop' branch"
    else
        echo "'develop' branch already exists, skipping creation"
    fi

    git switch "$GIT_DEFAULT_BRANCH"
}
