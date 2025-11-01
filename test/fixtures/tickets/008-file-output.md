---
id: "008"
title: Add file output support
branch: feat/008-file-output
status: OPEN
blocking: true
---

## Objective

- Enable writing formatted primes to a user-specified file with safety checks.
- Source: Implementation Plan > Feature 3.

## Scope

- Extend the CLI to accept `--output file` plus a file path argument.
- Implement overwrite guard (prompt or flag-based decision per outline philosophy, default to safe failure if file exists).
- Handle IO errors gracefully with non-zero exit codes and clear messaging.

## Out of Scope

- Additional output destinations (e.g., sockets, databases).
- Complex file locking or backup strategies.
- Format rendering beyond delegating to existing formatters.

## Requirements

- CLI writes formatted prime data to the target file when requested.
- Existing stdout mode remains default and unaffected.
- Tests cover successful file writes and overwrite-prevention behavior.
