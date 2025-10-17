#!/usr/bin/env bash
set -euo pipefail

project_path="${1:-}"
if [[ -z "${project_path}" ]]; then
  echo "Usage: $0 <project_path>" >&2
  exit 1
fi

echo "Setting up test project at: ${project_path}"

# Create directory structure that the controller expects
mkdir -p "${project_path}/agent/tickets"
mkdir -p "${project_path}/agent/templates"
mkdir -p "${project_path}/agent/scripts"

# Create a mock git_commit.sh script that doesn't actually commit
cat > "${project_path}/agent/scripts/git_commit.sh" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
commit_message="${1:-Auto commit}"
echo "Mock commit: ${commit_message}"
EOF

chmod +x "${project_path}/agent/scripts/git_commit.sh"

echo "Project setup completed successfully"