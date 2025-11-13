#!/usr/bin/env bash
set -euo pipefail

# Environment variables to configure
ENV_VARS=(
    "AGENT_REPO"
    "DEV_WORKSPACE"
    "DATABASE_URL"
    "AGENT_FOLDER_NAME"
    "GIT_DEFAULT_BRANCH"
    "GIT_USERNAME"
    "GIT_EMAIL"
    "CODEX_OSS_BASE_URL"
)

setup_environment_variables() {
    echo "[setup-env] Configuring environment variables at runtime"

    # Create temp files with fresh content
    local bash_env="/tmp/bash.env.$$"
    local system_env="/tmp/system.env.$$"
    local ssh_env="/root/.ssh/environment"

    mkdir -p /root/.ssh

    # Generate environment files
    : > "$bash_env"
    : > "$system_env"
    : > "$ssh_env"

    for var in "${ENV_VARS[@]}"; do
        value="${!var:-}"
        if [[ -n "$value" ]]; then
            echo "export ${var}=\"${value}\"" >> "$bash_env"
            echo "${var}=\"${value}\"" >> "$system_env"
            echo "${var}=${value}" >> "$ssh_env"
        fi
    done

    # Idempotently add to bashrc (replace if exists)
    if grep -q "# DEVSLAVE_ENV_START" /etc/bash.bashrc 2> /dev/null; then
        # Remove existing block
        sed -i '/# DEVSLAVE_ENV_START/,/# DEVSLAVE_ENV_END/d' /etc/bash.bashrc
    fi
    # Add fresh block
    {
        echo ""
        echo "# DEVSLAVE_ENV_START"
        cat "$bash_env"
        echo "# DEVSLAVE_ENV_END"
    } >> /etc/bash.bashrc

    # Idempotently add to /etc/environment (replace if exists)
    if grep -q "# DEVSLAVE_ENV_START" /etc/environment 2> /dev/null; then
        # Remove existing block
        sed -i '/# DEVSLAVE_ENV_START/,/# DEVSLAVE_ENV_END/d' /etc/environment
    fi
    # Add fresh block
    {
        echo ""
        echo "# DEVSLAVE_ENV_START"
        cat "$system_env"
        echo "# DEVSLAVE_ENV_END"
    } >> /etc/environment

    # SSH environment permissions
    chmod 600 "$ssh_env"

    # Cleanup temp files
    rm -f "$bash_env" "$system_env"

    echo "[setup-env] Environment configuration complete"
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_environment_variables
fi
