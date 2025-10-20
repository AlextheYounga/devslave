#!/usr/bin/env bash
set -euo pipefail

setup_directory_structure() {
    mkdir -p src
    mkdir -p tests
}

setup_node() {
    # Setup nvm and Node.js
    if [[ -f ~/.nvm/nvm.sh ]]; then
    source ~/.nvm/nvm.sh
    
    # Create .nvmrc if it doesn't exist
    if [[ ! -f .nvmrc ]]; then
        echo "lts/*" > .nvmrc
        echo "Created .nvmrc file"
    else
        echo ".nvmrc already exists, skipping"
    fi
    
    # Install Node.js if not already installed for this version
    if ! nvm which "$(cat .nvmrc)" >/dev/null 2>&1; then
        nvm install
        echo "Installed Node.js version $(cat .nvmrc)"
    else
        nvm use
        echo "Node.js version $(cat .nvmrc) already installed"
    fi
    else
        cho "Warning: nvm not found at ~/.nvm/nvm.sh, skipping Node.js setup"
    fi
}

setup_package_json() {
    if [[ ! -f package.json ]]; then
        npm init -y
        echo "Created package.json"
    else
        echo "package.json already exists, skipping npm init"
    fi
}

setup_gitignore() {
    if [[ ! -f .gitignore ]]; then
        cp "${stubs_folder}/node-gitignore.txt" .gitignore || true
    else
        echo "Node.js gitignore rules already present, skipping"
    fi
}

commit_changes() {
    # Add and commit changes (only if there are changes)
    git add -A
    if git diff --cached --quiet; then
        echo "No changes to commit"
    else
        git commit -m "chore: add node setup" --no-gpg-sign || true
        echo "Committed Node.js setup changes"
    fi
}

run_node_functions() {
    cd "${codebase_path}"
    setup_directory_structure
    setup_node
    setup_package_json
    setup_gitignore
    commit_changes
}






