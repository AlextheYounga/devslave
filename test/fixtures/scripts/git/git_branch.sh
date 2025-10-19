#!/bin/bash
# Test fixture for git_branch.sh
# Does not actually run git commands

codebase_path=$1
branch_name=$2

echo "Mock git branch creation executed"
echo "Codebase path: $codebase_path"
echo "Branch name: $branch_name"
echo "Successfully created branch: $branch_name"