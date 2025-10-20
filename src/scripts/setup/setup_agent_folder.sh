setup_agent_folder() {
    # Set up agent folder
    mkdir -p "${codebase_path}"
    mkdir -p "${codebase_path}/docs"
    mkdir -p "${codebase_path}/${AGENT_FOLDER}/tickets"
    mkdir -p "${codebase_path}/${AGENT_FOLDER}/scripts"

    # Create PROJECT.md with master prompt
    touch "${codebase_path}/${AGENT_FOLDER}/PROJECT.md"
    cat master_prompt > "${codebase_path}/${AGENT_FOLDER}/PROJECT.md"

    prompts_dir="${AGENT_REPO}/src/prompts"
    cp -R "${prompts_dir}/." "${codebase_path}/${AGENT_FOLDER}/" || true

    # Adding scripts (if directory exists)
    if [[ -d "${AGENT_REPO}/src/scripts/agent" ]]; then
        cp -R "${AGENT_REPO}/src/scripts/agent/." "${codebase_path}/${AGENT_FOLDER}/scripts"
    fi
}