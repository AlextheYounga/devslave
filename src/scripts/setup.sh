#!/usr/bin/env bash
set -euo pipefail

# Args
setup_type=${1:-}
project_path=${2:-}
agent_folder=${3:-"agent"}

if [[ -z "${setup_type}" || -z "${project_path}" ]]; then
  echo "Usage: $0 <setup_type: node|python> <project_path> [agent_folder]" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
stubs_folder="${script_dir}/stubs"

source "${script_dir}/git/git_init.sh"
source "${script_dir}/setup/node_functions.sh"
source "${script_dir}/setup/python_functions.sh"

setup_agent_folder() {
    # Set up agent folder
    mkdir -p "${project_path}"
    mkdir -p "${project_path}/docs"
    mkdir -p "${project_path}/${agent_folder}/tickets"
    mkdir -p "${project_path}/${agent_folder}/scripts"

    prompts_dir="${repo_root}/src/prompts"
    cp -R "${prompts_dir}/." "${project_path}/${agent_folder}/" || true

    # Adding scripts (if directory exists)
    if [[ -d "${repo_root}/src/scripts/agent" ]]; then
        cp -R "${repo_root}/src/scripts/agent/." "${project_path}/${agent_folder}/scripts"
    fi
}

setup_precommit() {
    # Add pre-commit config (no network; install only if pre-commit exists)
    cp "${stubs_folder}/precommitconfig.yaml" "${project_path}/.pre-commit-config.yaml" || true

    # Move to project folder
    cd "${project_path}"

    if command -v pre-commit >/dev/null 2>&1; then
        pre-commit install || true
    fi
}

main() {
    setup_agent_folder
    setup_precommit
    git_init

    if [[ "${setup_type}" == "node" ]]; then
        run_node_functions
    elif [[ "${setup_type}" == "python" ]]; then
        run_python_functions
    else
        echo "Unknown setup type: ${setup_type}" >&2
        exit 1
    fi
}

main

