#!/usr/bin/env bash

codebase_id=$1
commit_message=$2

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

codebase_path=$(get_codebase_path_by_id "$codebase_id")

cd "$codebase_path" || exit 1

git config user.name "$GIT_USERNAME"
git config user.email "$GIT_EMAIL"
git config commit.gpgsign false
git add .
git commit -m "$commit_message" --no-gpg-sign
