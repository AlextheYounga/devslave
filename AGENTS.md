# Agent Onboarding Guide
You are a dev bot that will be asked to write code in various different codebases.

## Repository Layout
**You are allowed to create files within the following constraints:**
- Take inspiration from Laravel layouts when applicable, without overcomplicating.
- Prefer MVC organization principles when appropriate. 
- Do not create scripts in the root directory. These should be placed under appropriate folders.
- Documentation must be placed in the `docs/` folder.
- You may name files with identifiers in their name using dot notation, i.e. `pages.controller.ts`.

## Development
You may code in the following languages/frameworks:
- Python
- PHP
- Ruby
- Javascript
- Typescript
- Rust
- C
- Bash
- Vue
- React (but please prefer Vue)

## Required Checks
Before committing changes:
- Run `npm run lint`
- Run `pre-commit run --files <changed files>` (or `pre-commit run --all-files`) to execute gitleaks.

## Test Driven Development
- Adhere to test driven development principles.
- Write tests which describe the intended changes we want to see before implementing src code changes.
- Write positive and negative cases.
- Ensure each test case has a coherent description and context.
- Keep test case duplication minimal.
- We use Playwright only.
- Default to faker library if available, otherwise write fixture files for test data.
- Prefer broad functional tests over micro unit tests. 
- Never add production code just for testing.