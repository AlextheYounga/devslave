---
id: "011"
title: Configure entry point packaging
branch: feat/011-entry-point
status: OPEN
blocking: true
---

## Objective

- Wire the CLI into packaging metadata for easy installation.
- Source: Implementation Plan > Feature 4.

## Scope

- Update `pyproject.toml` (or equivalent) with console script entry point referencing the CLI module.
- Ensure module layout supports invocation via `python -m primenumberfinder` and installed script.
- Validate packaging metadata builds without errors (e.g., `pip install -e .`).

## Out of Scope

- Publishing to PyPI or versioning strategy.
- Complex dependency management beyond standard library constraint.
- Cross-platform installer creation.

## Requirements

- Running packaging build commands produces an executable `primenumberfinder` console script.
- `python -m primenumberfinder --limit 10` continues to work post-change.
- Add or update tests/documentation confirming entry point functionality.
