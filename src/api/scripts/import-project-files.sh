#!/usr/bin/env bash

set -euo pipefail

# Script to import project files from a temporary location to the final destination
# Handles nested folder structures and removes agent folders

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <temp_path> <nested_folder_name> <agent_folder_name> <destination_path>"
    exit 1
fi

TEMP_PATH="$1"
NESTED_NAME="$2"
AGENT_FOLDER_NAME="$3"
DESTINATION_PATH="$4"

IMPORT_ROOT="${TEMP_PATH}"

# If the temp path contains only a single nested folder with the expected name,
# unwrap it and import from inside that folder instead
if [ "${NESTED_NAME}" != "" ] && [ -d "${TEMP_PATH}/${NESTED_NAME}" ]; then
    ENTRY_COUNT=$(ls -A "${TEMP_PATH}" | wc -l | tr -d '[:space:]')
    if [ "${ENTRY_COUNT}" = "1" ]; then
        IMPORT_ROOT="${TEMP_PATH}/${NESTED_NAME}"
    fi
fi

# Remove any existing agent folder from the import source
if [ -d "${IMPORT_ROOT:?}/${AGENT_FOLDER_NAME:?}" ]; then
    rm -rf "${IMPORT_ROOT:?}/${AGENT_FOLDER_NAME:?}"
fi

# Ensure destination exists and copy all files
mkdir -p "${DESTINATION_PATH}"
cp -R "${IMPORT_ROOT}/." "${DESTINATION_PATH}/"
