#!/bin/bash
$project_path=$1

mkdir -p $project_path

# Set up agent folder
mkdir -p $project_path/codex/tickets
mkdir -p $project_path/docs

cp ../../prompts/onboarding.md $project_path/AGENTS.md
cp ../../prompts/roles $project_path/codex/roles
cp ../../prompts/templates $project_path/codex/templates
touch $project_path/codex/PROJECT.md

# Move to project folder
cd $project_path

# Add pre-commit config
touch .pre-commit-config.yaml
cat << EOF > .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.2
    hooks:
      - id: gitleaks
EOF

pre-commit install

# Setup Git
git init
git branch -m master
git config user.name "Alex Younger Agent"
git config user.email "thealexyounger@proton.me"

git add .
git commit -m "initial commit"
