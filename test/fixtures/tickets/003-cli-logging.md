---
id: '003'
title: CLI logging baseline
branch: feat/003-cli-logging
status: OPEN
blocking: true
---

## Objective
- Configure logging for the CLI entrypoint.
- Source: Implementation Plan > Feature 1.

## Scope
- Initialize the `logging` module with INFO-level output in the CLI startup path.
- Emit log messages indicating accepted limit and total primes produced (placeholder count acceptable until core is ready).
- Ensure logs integrate cleanly with existing CLI output behavior.

## Out of Scope
- Detailed debug-level tracing or configurable log verbosity.
- Integration with external logging handlers.
- Modifying core prime generation logic beyond logging hooks.

## Requirements
- Logging configuration happens once per invocation without duplicate handlers.
- Successful CLI execution logs limit and prime count summaries.
- Tests verify logging occurs at INFO level without polluting stdout meant for prime data.
