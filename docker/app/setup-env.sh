#!/usr/bin/env bash
set -euo pipefail

# Environment variables to configure
ENV_VARS=(
    "AGENT_REPO"
    "DEV_WORKSPACE"
    "DB_ABSOLUTE_URL"
    "AGENT_FOLDER_NAME"
    "GIT_DEFAULT_BRANCH"
    "GIT_USERNAME"
    "GIT_EMAIL"
)

setup_environment_variables() {
    echo "[setup-env] Configuring environment variables at runtime"

    # Clear previous configurations
    > /etc/bash.bashrc.env
    > /etc/environment.env
    mkdir -p /root/.ssh
    > /root/.ssh/environment

    # Set up bash environment
    for var in "${ENV_VARS[@]}"; do
        value="${!var:-}"
        if [[ -n "$value" ]]; then
            echo "export ${var}=\"${value}\"" >> /etc/bash.bashrc.env
        fi
    done

    # Set up system environment
    for var in "${ENV_VARS[@]}"; do
        value="${!var:-}"
        if [[ -n "$value" ]]; then
            echo "${var}=\"${value}\"" >> /etc/environment.env
        fi
    done

    # Set up SSH environment for root user
    for var in "${ENV_VARS[@]}"; do
        value="${!var:-}"
        if [[ -n "$value" ]]; then
            echo "${var}=${value}" >> /root/.ssh/environment
        fi
    done

    # Append to main config files
    cat /etc/bash.bashrc.env >> /etc/bash.bashrc
    cat /etc/environment.env >> /etc/environment

    echo "[setup-env] Environment configuration complete"
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_environment_variables
fi
