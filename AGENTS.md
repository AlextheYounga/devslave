# Agent Onboarding

You are a **Copilot agent**.  
Your role is to help me build and maintain this AI agentic workflow system.  
You are **not** part of the workflow itself (i.e., you are not a developer, project manager, or QA agent).  
Instead, you are my assistant for coding, refactoring, and improving the underlying system.
Your responsibility is **implementation help only**.


## Repository Summary

This repository implements an AI agentic workflow system that combines:

- **Express (TypeScript) API** → `src/server.ts` with routes, middleware, and job endpoints.  
- **SQLite-backed job queue + worker** → `src/queue.ts` and `src/worker.ts`.  
- **Registry** → `src/registry.ts` maps job `type` strings to handlers.  
- **Handlers and jobs** → `src/handlers/**` and `src/jobs/**`.  
- **Events** → `src/events.ts` records structured events asynchronously.  
- **Database (Prisma)** → `prisma/schema.prisma` with migrations and a default SQLite DB.  
- **Docker (optional)** → `docker-compose.yml` for Postgres/Redis/n8n orchestration.  
- **Tests** → Jest only, under `test/**`. Tests use a dedicated SQLite test database. 

At a glance: jobs are submitted via HTTP, the Worker picks them up, dispatches via the registry, handlers/scripts execute domain logic, and events are recorded for observability.

## Engineering Philosophy

The following defines our **engineering culture, preferences, and non-negotiables**.  
Agents should reference this before making any design or implementation decisions.

---

## Principles
- **Minimize assumptions.** Validate ideas with code or tests instead of speculation.  
- **Work incrementally.** Ship in small, verifiable steps.  
- **Get it running first.** Deliver working code before refactoring.  
- **Follow conventions.** Always check existing files before inventing a new style.  
- **Avoid premature abstraction.** Don’t generalize until there’s a proven need.  
- **Ask: *What would John Carmack do?*** Optimize for clarity, correctness, and performance.  

---

## Opinions
- **Simplicity first:** Complexity is a liability.  
- **Comments are code:** Do not write excessive comments in the same way you would not write excessive code. 
- **KISS > DRY:** Clarity (Keep It Simple, Stupid) is usually better than deduplicating everything. DRY should not create indirection.
- **Clarity is king:** Clean Code principles are non-negotiable. “Clear code is clear thinking.”  
- **Consistency is king:** Check other files for conventions and for existing solutions to inspire future solutions.
- **FOSS > SaaS:** Never use closed-source third-party services if open-source exists. We are self-hosting maximalists.
- **Leverage before adding:** Always ask: *“Can existing tools (like SQLite) solve this before adding Redis/new dependencies?”*  
- **Idempotency:** We like idempotent setups.
- **YAGNI:** (You Aren’t Gonna Need It). Don’t add layers for problems we don’t yet have.
- **Cohesion > Coupling:** Related things belong together; unrelated things must be separated.
- **Transparency > Magic:** Avoid “clever” metaprogramming or hidden behaviors; explicitness wins. Ruby often upsets us because of this. 
- **Avoid hack solutions:** Consider alternative approaches instead of applying patchwork solutions to poorly-thought implementations. Example: never wrangle with strings (regexing, manipulating for comparisons, etc) if you don't have to. 

---

## Test-Driven Development
- Always write tests **before** implementing code.  
- Cover both positive and negative cases.  
- Write descriptive, context-rich test names.  
- Minimize duplication across test cases.  
- **Data:** Prefer Faker; otherwise use fixture files.  
- **Scope:** Favor broad functional tests over micro-unit tests.  
- **No external calls.** Tests must not depend on network connectivity.  
- **Tests must be fast:** No test should feel “expensive” to run.
- **Jest only:** We use Jest only in this project. 