#!/usr/bin/env bash
set -euo pipefail

# Args
setup_type=$1
project_path=$2
agent_folder=${3:-"agent"}

if [[ -z "${setup_type}" || -z "${project_path}" ]]; then
  echo "Usage: $0 <setup_type: node|python|test|failing> <project_path> [agent_folder]" >&2
  exit 1
fi

echo "Setting up ${setup_type} project at: ${project_path}"

# Mock function for test setup
setup_agent_folder() {
    mkdir -p "${project_path}"
    mkdir -p "${project_path}/docs"
    mkdir -p "${project_path}/${agent_folder}/tickets"
    mkdir -p "${project_path}/${agent_folder}/scripts"
    
    # Create a mock git_commit.sh script that doesn't actually commit
    cat > "${project_path}/${agent_folder}/scripts/git_commit.sh" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
commit_message="${1:-Auto commit}"
echo "Mock commit: ${commit_message}"
EOF
    
    chmod +x "${project_path}/${agent_folder}/scripts/git_commit.sh"
}

main() {
    if [[ "${setup_type}" == "failing" ]]; then
        echo "Simulating failure for test purposes" >&2
        exit 1
    fi
    
    setup_agent_folder
    
    if [[ "${setup_type}" == "node" ]]; then
        echo "Running node setup functions"
    elif [[ "${setup_type}" == "python" ]]; then
        echo "Running python setup functions"
    elif [[ "${setup_type}" == "test" ]]; then
        echo "Running test setup functions"
    else
        echo "Unknown setup type: ${setup_type}" >&2
        exit 1
    fi
    
    echo "Project setup completed successfully"
}

main