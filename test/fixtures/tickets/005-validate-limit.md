---
id: '005'
title: Guard invalid limits
branch: feat/005-validate-limit
status: OPEN
blocking: true
---

## Objective
- Add input validation to `generate_primes` for limits below 2 and non-integers.
- Source: Implementation Plan > Feature 2.

## Scope
- Validate `limit` type and value prior to sieve execution, raising `ValueError` when invalid.
- Provide clear error messages indicating the acceptable range.
- Update tests to cover edge cases (`limit` 0, 1, negative values, non-int inputs).

## Out of Scope
- CLI-level validation (handled separately).
- Performance enhancements unrelated to validation.
- Localization of error messages.

## Requirements
- `generate_primes` raises `ValueError` for all invalid inputs with consistent messaging.
- Valid inputs (>=2) continue to return correct prime lists.
- Test suite includes coverage for each invalid scenario.
