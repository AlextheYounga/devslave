---
id: "004"
title: Implement sieve generator
branch: feat/004-generate-primes
status: OPEN
blocking: true
---

## Objective

- Build the `generate_primes(limit: int) -> list[int]` function using the Sieve of Eratosthenes.
- Source: Implementation Plan > Feature 2.

## Scope

- Implement the sieve algorithm in `prime/core.py` returning ordered prime integers up to `limit`.
- Optimize for limits up to 10^7 while respecting memory constraints.
- Include docstring summarizing algorithm approach and assumptions.

## Out of Scope

- Input validation beyond assuming a well-formed positive integer.
- Performance instrumentation or benchmarks.
- CLI integration or output formatting changes.

## Requirements

- Function returns accurate primes for representative test cases (e.g., 30 -> [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]).
- Implementation runs within reasonable time for limit=10_000 under unit tests.
- Unit tests confirm correctness for small and medium ranges.
