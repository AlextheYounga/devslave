---
id: '012'
title: Add CLI version flag
branch: feat/012-version-flag
status: OPEN
blocking: true
---

## Objective
- Provide a `--version` flag reporting the package version.
- Source: Implementation Plan > Feature 4.

## Scope
- Extend CLI argument parsing to accept `--version` and print current version info.
- Ensure version data derives from a single canonical location (e.g., module `__version__`).
- Confirm flag exits cleanly without extra output when invoked.

## Out of Scope
- Automated version bumping tooling.
- Release management processes.
- Additional metadata flags.

## Requirements
- Running `primenumberfinder --version` displays semantic version and exits 0.
- Tests cover version flag output and ensure it stays in sync with package metadata.
- Documentation references the new flag where appropriate.
