#!/usr/bin/env bash
set -euo pipefail

# Args
project_path=$1
$prompt=$2

if [[ -z "$project_path" || -z "$prompt" ]]; then
  echo "Usage: $0 <project_path>" >&2
  exit 1
fi

cd $project_path

codex --dangerously-bypass-approvals-and-sandbox --cd=$project_path $prompt