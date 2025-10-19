#!/bin/bash
# Test fixture for git_commit.sh
# Does not actually run git commands

codebase_path=$1
commit_message=$2

echo "Mock git commit executed"
echo "Codebase path: $codebase_path"
echo "Commit message: $commit_message"
echo "Successfully committed changes"