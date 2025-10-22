# Architecture Overview
- **Goal:** Provide a small, test-driven CLI tool that enumerates prime numbers up to a user-supplied upper bound and emits them in deterministic order.
- **Constraints:** Python 3 runtime, standard library only unless a strong need emerges; must support non-interactive use (scripting); must complete within reasonable time for limits ≲10^7 on consumer hardware; follow repository philosophy (incremental, SQLite-only if persistence becomes necessary).
- **Assumptions:** Users pass an explicit positive integer limit (no implicit infinity); execution environment is a local shell with stdout consumption; memory budget fits an in-memory classic sieve for the accepted limit range.
- **Non-functional priorities:** Correctness first, then predictable performance, then ergonomics (clear help, helpful errors).

# System Design
- **Components:**
  - `main.py` CLI entrypoint using `argparse` for `--limit`, `--output` (stdout|file), and `--format` (plain|json).
  - `prime/core.py` with `generate_primes(limit: int) -> list[int]` implementing a Sieve of Eratosthenes plus guardrails for invalid input.
  - `prime/formatters.py` handling serialization to newline-delimited text or JSON array; kept simple to avoid premature generalization.
- **Data Flow:** CLI parses args → validates limit → delegates to `generate_primes` → forwards list to formatter → writes to stdout or file path; non-zero exit codes on validation errors or IO failures.
- **Interfaces:**
  - CLI contract: `python -m primenumberfinder --limit 100 --format json --output primes.json`.
  - Core API: `generate_primes(limit: int) -> list[int]` (raises `ValueError` on limit < 2).
  - Formatting API: `render_primes(primes: list[int], format: Literal["plain", "json"]) -> str`.
- **Data Model:** Primes represented as ordered Python `int` values; no persistent schema initially.
- **Cross-cutting concerns:** Logging via `logging` module at INFO for high-level progress (limit accepted, count of primes); configuration via CLI only; deterministic behavior ensures idempotent reruns.
- **Trade-offs:** Classic sieve chosen for clarity over segmented/parallel variants; storing full list trades memory for simplicity—acceptable within limit constraint; no caching/persistence to keep scope tight.

# Implementation Plan
- **Feature 1: CLI skeleton**
  - Todos: set up `argparse` parser with limit/format/output options; validate inputs and dispatch stubbed generator/formatter; integrate logging setup.
  - Dependencies: none.
  - Risks: argument validation paths must be fully tested; ensure exit codes reflect errors.
  - Tests: argparse contract tests via `subprocess` or `pytest` `capsys` to confirm help, error messages, and stdout behavior with stubbed generator (use monkeypatch).
  - Done when: running CLI with sample limit prints placeholder output and returns 0; invalid args produce helpful error and non-zero exit.
- **Feature 2: Prime generation core**
  - Todos: implement sieve-based `generate_primes`; guard invalid limits; document time/memory expectations.
  - Dependencies: Feature 1 (entrypoint to call core).
  - Risks: off-by-one errors at limit boundary; performance degrade for large limit—mitigate with integer math and list comprehension.
  - Tests: unit tests for small known ranges (<=30), edge cases (`limit` 0/1/2), performance sanity check for `limit=10_000` under threshold runtime.
  - Done when: tests confirm correct prime sets and invalid inputs raise `ValueError`.
- **Feature 3: Output formatting & sinks**
  - Todos: implement plain and JSON renderers; support optional file output with overwrite guard; ensure newline-terminated stdout.
  - Dependencies: Features 1 & 2.
  - Risks: file IO permissions; ensure JSON serialization handles empty list.
  - Tests: formatter unit tests; integration test verifying CLI writes expected stdout and file contents.
  - Done when: CLI emits correct format to stdout/file; tests cover both formats and error handling.
- **Feature 4: Packaging & docs polish**
  - Todos: update README with usage instructions; ensure `pyproject.toml` entry point script if packaging; add `--version` flag if desired.
  - Dependencies: prior features.
  - Risks: packaging metadata drift; ensure documentation matches behavior.
  - Tests: smoke test running `python -m primenumberfinder --limit 10`.
  - Done when: docs and packaging build successfully; CLI usage instructions verified manually.

# Operational Notes
- **Logging:** INFO-level summary (limit, prime count); DEBUG reserved for future troubleshooting.
- **Configuration:** CLI flags only; no environment config required; defaults `format=plain`, `output=stdout`.
- **Rollout:** Ship as a local CLI script; optional packaging via pip once integration tests pass.
- **Maintenance:** Re-run test suite before releases; consider segmented sieve only if performance requirements increase.
