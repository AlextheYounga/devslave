---
id: '002'
title: CLI validation & dispatch
branch: feat/002-cli-validation
status: OPEN
blocking: true
---

## Objective
- Implement argument validation and stub dispatch to core components.
- Source: Implementation Plan > Feature 1.

## Scope
- Validate that `--limit` is a positive integer and exit non-zero with helpful messaging when invalid.
- Wire parsed arguments to placeholder calls for `generate_primes` and formatter functions.
- Ensure CLI returns success with stubbed data when inputs pass validation.

## Out of Scope
- Real prime generation or formatting logic.
- Logging setup beyond basic stderr output from `argparse`.
- Integration with file output destinations.

## Requirements
- Invalid limits (<=0 or non-integers) cause a non-zero exit with descriptive error.
- Successful runs invoke clearly named placeholder functions for core and formatter modules.
- Unit or functional tests cover at least one success and one failure path for validation.
