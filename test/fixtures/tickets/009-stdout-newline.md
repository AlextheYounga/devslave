---
id: "009"
title: Ensure stdout formatting
branch: feat/009-stdout-newline
status: OPEN
blocking: true
---

## Objective

- Guarantee deterministic stdout emission with trailing newline semantics.
- Source: Implementation Plan > Feature 3.

## Scope

- Audit stdout code paths to ensure plain output ends with a newline and no extraneous whitespace.
- Verify JSON output is properly terminated without additional characters.
- Add regression tests covering stdout behavior for both formats.

## Out of Scope

- File output handling (covered elsewhere).
- Changes to logging configuration.
- CLI argument structure adjustments beyond ensuring consistent output.

## Requirements

- CLI stdout output matches formatter expectations exactly, including trailing newline rules.
- Tests assert byte-for-byte stdout matches for sample runs in both formats.
- Behavior remains deterministic across repeated invocations.
