#!/usr/bin/env bash

# Shared helper to run read-only SQL queries against the configured Postgres database.
db_query() {
    local sql=$1

    if [[ -z "${DATABASE_URL:-}" ]]; then
        echo "Error: DATABASE_URL is not set." >&2
        return 1
    fi

    if ! command -v psql > /dev/null 2>&1; then
        echo "Error: psql command not found in PATH." >&2
        return 1
    fi

    psql -At -F '|' -P pager=off --no-psqlrc "$DATABASE_URL" -c "$sql"
}
