---
id: '007'
title: Implement prime formatters
branch: feat/007-formatters
status: OPEN
blocking: true
---

## Objective
- Provide plain text and JSON renderers for prime output.
- Source: Implementation Plan > Feature 3.

## Scope
- Create `prime/formatters.py` exposing `render_primes(primes, format)` with `plain` and `json` support.
- Ensure JSON rendering returns a compact JSON array string; plain renders newline-delimited primes with trailing newline.
- Handle empty input list gracefully without errors.

## Out of Scope
- File writing or CLI integration.
- Additional output formats beyond plain and JSON.
- Logging or progress reporting.

## Requirements
- Unit tests verify correct string output for both formats, including empty primes list.
- Function raises descriptive error on unsupported formats.
- Module uses only Python standard library constructs (e.g., `json`).
