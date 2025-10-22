---
id: '001'
title: CLI parser scaffolding
branch: feat/001-cli-parser
status: OPEN
blocking: true
---

## Objective
- Establish the CLI parser structure with required options.
- Source: Implementation Plan > Feature 1.

## Scope
- Add `main.py` entrypoint wiring using `argparse`.
- Define `--limit`, `--format`, and `--output` arguments matching outlined defaults.
- Ensure help text reflects available choices for format and output targets.

## Out of Scope
- Implementing prime generation logic.
- Final output formatting behavior or file writing.
- Logging configuration or message emission.

## Requirements
- Running the module exposes the parser and prints usage without errors.
- CLI accepts the three named arguments with appropriate types and defaults.
- Argument choices enforce `format` in [`plain`, `json`] and `output` in [`stdout`, `file`].
