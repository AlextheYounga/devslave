setup_precommit() {
    # Add pre-commit config (no network; install only if pre-commit exists)
    cp "${stubs_folder}/precommitconfig.yaml" "${codebase_path}/.pre-commit-config.yaml" || true

    # Move to project folder
    cd "${codebase_path}"

    if command -v pre-commit >/dev/null 2>&1; then
        pre-commit install || true
    fi
}