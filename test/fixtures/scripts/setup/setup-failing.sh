#!/usr/bin/env bash
set -euo pipefail

project_path="${1:-}"
if [[ -z "${project_path}" ]]; then
  echo "Usage: $0 <project_path>" >&2
  exit 1
fi

echo "This script is designed to fail for testing purposes" >&2
exit 1