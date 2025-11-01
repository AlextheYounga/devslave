---
id: "010"
title: Update README usage
branch: feat/010-readme-usage
status: OPEN
blocking: true
---

## Objective

- Refresh project documentation with CLI usage guidance.
- Source: Implementation Plan > Feature 4.

## Scope

- Add sections to `README.md` covering install prerequisites and example commands.
- Document supported flags (`--limit`, `--format`, `--output`, `--version`).
- Include guidance for scripting/non-interactive scenarios per outline assumptions.

## Out of Scope

- Auto-generated API documentation.
- Localization or translation of docs.
- Release notes or changelog updates.

## Requirements

- README includes copy-pastable examples demonstrating both stdout and file output.
- Documentation aligns with implemented CLI behavior and defaults.
- Markdown passes existing lint or formatting expectations (if any).
