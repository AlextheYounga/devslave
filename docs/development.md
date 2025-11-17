# Development Guide

This guide covers how to contribute to DevSlave, set up a local development environment, and follow our engineering practices.

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Git
- PostgreSQL client (optional, for manual DB access)
- Your favorite editor (we use VS Code)

### Initial Setup

```bash
# 1. Clone repository
git clone < repository-url > devslave
cd devslave

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Configure .env
# Edit .env and set required variables
nano .env
```

### Running Locally (Without Docker)

For faster iteration during development:

```bash
# 1. Start only infrastructure services
docker-compose up -d postgres redis

# 2. Run database migrations
npm run db:migrate

# 3. Start API server (with hot reload)
npm run server:dev

# 4. In another terminal, use CLI
npm run dev
```

### Running in Docker

For full system testing:

```bash
# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f app

# Run migrations
docker-compose exec app npm run db:migrate

# Access CLI
docker-compose exec app npm run dev
```

## Project Structure

```
src/
├── server.ts           # Express server entrypoint
├── routes.ts           # Route definitions
├── cli.ts              # CLI entrypoint
├── prisma.ts           # Prisma client singleton
├── events.ts           # Event recording system
├── constants.ts        # Configuration constants
│
├── cli/                # CLI implementation
│   ├── index.ts        # Main CLI logic
│   ├── menus.ts        # Inquirer menu definitions
│   ├── workflows.ts    # Workflow trigger handlers
│   └── logs.ts         # Log viewing utilities
│
├── controllers/        # HTTP request handlers
│   ├── agent.controller.ts
│   ├── codebase.controller.ts
│   ├── tickets.controller.ts
│   └── health.controller.ts
│
├── handlers/           # Business logic (domain layer)
│   ├── startAgent.handler.ts
│   ├── getAgentStatus.handler.ts
│   ├── watchAgent.handler.ts
│   ├── killAgent.handler.ts
│   ├── setupCodebase.handler.ts
│   ├── scanTicket.handler.ts
│   ├── updatePhase.handler.ts
│   └── ...
│
├── prompts/            # Agent system prompts
│   ├── system/         # Role-specific prompts
│   │   ├── architect.md
│   │   ├── pm.md
│   │   ├── dev.md
│   │   └── qa.md
│   └── handoffs/       # Shared context files
│       ├── philosophy.md
│       ├── onboarding/
│       └── templates/
│
├── scripts/            # Bash automation
│   ├── launch-agent.sh
│   ├── import-project-files.sh
│   ├── setup.sh
│   ├── agent/
│   │   └── run_codex.sh
│   ├── lib/
│   │   └── db.sh
│   └── setup/
│       ├── git_init.sh
│       └── <lang>_functions.sh
│
└── utils/              # Shared utilities
    └── validation.ts
```

## Development Workflow

### 1. Understanding the Request

Before writing any code:

1. **Read existing code** - Check how similar features are implemented
2. **Understand the architecture** - Review [architecture.md](architecture.md)
3. **Check conventions** - Look at file naming, patterns, structure
4. **Consider alternatives** - Is there a simpler approach?

### 2. Write Tests First (TDD)

We practice **Test-Driven Development**:

```bash
# Create test file first
touch test/src/api/handlers/myFeature.handler.test.ts
```

**Test Structure:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../../src/prisma';
import { myFeatureHandler } from '../../../src/api/handlers/myFeature.handler';
import { setupTestDatabase, teardownTestDatabase } from '../../setup';

describe('myFeatureHandler', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('happy path', () => {
    it('should do the expected thing', async () => {
      // Arrange
      const input = { ... };

      // Act
      const result = await myFeatureHandler(input);

      // Assert
      expect(result).toMatchObject({ ... });
    });
  });

  describe('error cases', () => {
    it('should throw when input is invalid', async () => {
      await expect(myFeatureHandler(null))
        .rejects
        .toThrow('Invalid input');
    });
  });
});
```

**Run tests:**

```bash
# All tests
npm test

# Specific file
npm test -- myFeature.handler.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### 3. Implement

Follow our engineering principles (see [AGENTS.md](../AGENTS.md)):

- **Keep it simple** - Avoid premature abstraction
- **Clear > Clever** - Prefer readable code over "smart" solutions
- **Consistency** - Match existing patterns
- **Cohesion** - Related code stays together

**Example Handler:**

```typescript
// src/api/handlers/myFeature.handler.ts

import { prisma } from '../prisma';
import { recordEvent } from '../events';

export async function myFeatureHandler(input: MyFeatureInput): Promise<MyFeatureResult> {
  // 1. Validate input
  if (!input?.id) {
    throw new Error('ID is required');
  }

  // 2. Query database
  const record = await prisma.myModel.findUnique({
    where: { id: input.id }
  });

  if (!record) {
    throw new Error('Record not found');
  }

  // 3. Business logic
  const result = performBusinessLogic(record);

  // 4. Persist changes
  await prisma.myModel.update({
    where: { id: input.id },
    data: { ...result }
  });

  // 5. Record event
  await recordEvent({
    type: 'myFeature.completed',
    data: { id: input.id, result }
  });

  // 6. Return
  return result;
}

function performBusinessLogic(record: MyModel): MyFeatureResult {
  // Pure function, easy to test
  return { ... };
}
```

**Example Controller:**

```typescript
// src/api/controllers/myFeature.controller.ts

import { Request, Response } from "express";
import { myFeatureHandler } from "../handlers/myFeature.handler";

export async function myFeature(req: Request, res: Response) {
    try {
        const result = await myFeatureHandler(req.body);
        res.json(result);
    } catch (error) {
        console.error("myFeature error:", error);
        res.status(400).json({ error: (error as Error).message });
    }
}
```

**Add Route:**

```typescript
// src/routes.ts

import { myFeature } from "./controllers/myFeature.controller";

router.post("/api/my-feature", myFeature);
```

### 4. Format Code

```bash
npm run format
```

We use Prettier with these settings:

```json
{
    "semi": true,
    "singleQuote": false,
    "tabWidth": 4,
    "trailingComma": "es5"
}
```

### 5. Commit

```bash
git add .
git commit -m "feat: add myFeature handler

- Implements new feature X
- Adds tests covering happy path and errors
- Updates API routes"
```

**Commit Message Format:**

```
<type>: <subject>

<body>

<footer>
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code restructuring (no functional change)
- `test:` - Adding/updating tests
- `chore:` - Maintenance (deps, config, etc.)

## Testing Philosophy

### Principles

1. **Tests must be fast** - No test should take > 1 second
2. **Favor integration tests** - Test real behavior, not internals
3. **No external dependencies** - Tests should work offline
4. **Use Faker for data** - Or fixture files when needed
5. **Descriptive test names** - Should read like documentation

### Test Database

Tests use a separate database (`devslave_test`):

```bash
# Setup test DB (first time)
npm run db:migrate:test

# Reset test DB (clears all data)
npm run db:reset:test
```

**Test Setup:**

```typescript
// test/setup.ts

export async function setupTestDatabase() {
    // Runs before each test suite
    // Ensures clean state
}

export async function teardownTestDatabase() {
    // Runs after each test suite
    // Cleans up test data
}
```

### Test Data

**Use Faker:**

```typescript
import { faker } from "@faker-js/faker";

const mockCodebase = {
    id: faker.string.uuid(),
    name: faker.company.name(),
    path: faker.system.filePath(),
    phase: "DEVELOPMENT",
    setup: true,
};
```

**Use Fixtures:**

```typescript
// test/fixtures/codebase.json
{
  "name": "Test Project",
  "path": "/app/dev/projects/test",
  "phase": "DEVELOPMENT"
}

// In test
import codebaseFixture from '../fixtures/codebase.json';
const codebase = await prisma.codebase.create({ data: codebaseFixture });
```

### Coverage Goals

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

**Check coverage:**

```bash
npm test -- --coverage
```

## Database Changes

### Creating Migrations

```bash
# 1. Edit schema
nano prisma/schema.prisma

# 2. Create migration
npm run db:migrate

# 3. Name migration descriptively
# Example: "add_agent_model_field"

# 4. Commit both schema and migration
git add prisma/
git commit -m "feat: add model field to Agent"
```

### Migration Best Practices

1. **Never edit existing migrations** - Create new ones
2. **Test migrations** - Apply to clean DB and verify
3. **Provide data migrations** - Use Prisma Client in migration SQL
4. **Document breaking changes** - Update README if needed

**Example Migration:**

```sql
-- Migration: 20241114_add_agent_model_field

-- Add column with default
ALTER TABLE "agents" ADD COLUMN "model" TEXT NOT NULL DEFAULT 'gpt-4';

-- Optional: Backfill data
UPDATE "agents" SET "model" = 'gpt-4' WHERE "model" IS NULL;
```

### Prisma Studio

Visual database browser:

```bash
# Local
npx prisma studio

# Docker
docker-compose exec app npx prisma studio
# Access at http://localhost:5555
```

## Debugging

### API Server

```bash
# Start with debugger
node --inspect=0.0.0.0:9229 dist/server.js

# In VS Code, attach debugger:
# Run -> Start Debugging -> Node: Attach
```

### Agent Execution

```bash
# Tail agent log
docker exec -it devslave-app-1 tail -f /tmp/agent_<id>.log

# Attach to tmux
docker exec -it devslave-app-1 tmux attach -t <session>

# List all sessions
docker exec devslave-app-1 tmux ls

# Kill stuck session
docker exec devslave-app-1 tmux kill-session -t <session>
```

### n8n Workflows

1. Open n8n UI: http://localhost:5678
2. Go to **Executions** tab
3. Click on failed execution
4. Inspect node inputs/outputs
5. Use **Test Workflow** for manual debugging

### Database Queries

```bash
# psql client (local)
psql postgresql://postgres:postgres@localhost:5432/devslave_app

# Docker
docker-compose exec postgres psql -U postgres devslave_app

# Common queries
SELECT * FROM agents WHERE status = 'RUNNING'
SELECT * FROM codebases WHERE active = true
SELECT * FROM events WHERE type LIKE 'agent.%' ORDER BY timestamp DESC LIMIT 10
```

## Adding New Features

### New Agent Role

1. **Create system prompt:**

    ```bash
    touch src/prompts/system/myrole.md
    ```

2. **Create onboarding doc:**

    ```bash
    touch src/prompts/handoffs/onboarding/myrole.md
    ```

3. **Create n8n workflow:**
    - Duplicate existing agent workflow in n8n UI
    - Update webhook path: `/webhook/myrole`
    - Customize prompt node
    - Export as JSON to `docker/n8n/workflows/`

4. **Update phase router in Master Workflow**

5. **Add tests:**
    ```bash
    touch test/src/api/handlers/startMyRoleAgent.handler.test.ts
    ```

### New API Endpoint

1. **Write handler test:**

    ```typescript
    // test/src/api/handlers/myHandler.handler.test.ts
    ```

2. **Implement handler:**

    ```typescript
    // src/api/handlers/myHandler.handler.ts
    ```

3. **Create controller:**

    ```typescript
    // src/api/controllers/myController.controller.ts
    ```

4. **Add route:**

    ```typescript
    // src/routes.ts
    router.post("/api/my-endpoint", myController.myAction);
    ```

5. **Test via curl:**
    ```bash
    curl -X POST http://localhost:3000/api/my-endpoint \
        -H "Content-Type: application/json" \
        -d '{"key": "value"}'
    ```

### New CLI Command

1. **Add menu option:**

    ```typescript
    // src/cli/menus.ts
    export const promptMainMenu = async () => {
        const { action } = await inquirer.prompt([
            {
                type: "list",
                name: "action",
                message: "What would you like to do?",
                choices: [
                    // ...existing options
                    { name: "🆕 My New Feature", value: "myFeature" },
                ],
            },
        ]);
        return action;
    };
    ```

2. **Implement handler:**

    ```typescript
    // src/cli/index.ts (or new file in src/cli/)
    async function handleMyFeature() {
        // Prompt for input
        const { input } = await inquirer.prompt([
            {
                type: "input",
                name: "input",
                message: "Enter something:",
            },
        ]);

        // Call handler or API
        const result = await myFeatureHandler(input);

        // Display result
        console.log("\n✅ Success!");
        console.log(result);
    }
    ```

3. **Wire up in CLI router:**

    ```typescript
    // src/cli/index.ts
    const action = await promptMainMenu();

    switch (action) {
        case "myFeature":
            await handleMyFeature();
            break;
        // ...
    }
    ```

## Performance Optimization

### Database Query Optimization

**Bad:**

```typescript
// N+1 query problem
const agents = await prisma.agent.findMany();
for (const agent of agents) {
    const codebase = await prisma.codebase.findUnique({
        where: { id: agent.codebaseId },
    });
}
```

**Good:**

```typescript
// Single query with join
const agents = await prisma.agent.findMany({
    include: { codebase: true },
});
```

### Async Optimization

**Bad:**

```typescript
// Sequential
await operation1();
await operation2();
await operation3();
```

**Good:**

```typescript
// Parallel
await Promise.all([operation1(), operation2(), operation3()]);
```

### Caching

For expensive operations:

```typescript
const cache = new Map<string, any>();

export async function getCachedData(key: string) {
    if (cache.has(key)) {
        return cache.get(key);
    }

    const data = await expensiveOperation(key);
    cache.set(key, data);
    return data;
}
```

## Troubleshooting

### "Cannot find module" Errors

```bash
# Rebuild
npm run build

# Or clear cache
rm -rf dist/
npm run build
```

### Database Connection Errors

```bash
# Check Postgres is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection
docker-compose exec app npx prisma db pull
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run server
```

### Docker Issues

```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs app
docker-compose logs postgres

# Shell into container
docker-compose exec app bash
```

## Code Review Checklist

Before submitting PR:

- [ ] Tests pass locally (`npm test`)
- [ ] Code formatted (`npm run format`)
- [ ] New tests added for new features
- [ ] Documentation updated (if needed)
- [ ] No console.log() left in production code
- [ ] Error handling implemented
- [ ] Database migrations tested
- [ ] No secrets committed
- [ ] Commit messages follow convention
- [ ] Follows existing patterns/conventions

## Resources

- [Architecture Deep Dive](architecture.md)
- [Workflow System](workflows.md)
- [Agent Lifecycle](agent-lifecycle.md)
- [Docker Setup](docker-setup.md)
- [Engineering Philosophy](../AGENTS.md)

## Getting Help

- Check [docs/](.) for detailed documentation
- Review existing code for patterns
- Search issues/PRs for similar problems
- Ask in team chat/discussions

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/my-feature`
3. Write tests
4. Implement feature
5. Run tests: `npm test`
6. Format code: `npm run format`
7. Commit changes: `git commit -m "feat: my feature"`
8. Push to fork: `git push origin feat/my-feature`
9. Open pull request

**PR Template:**

```markdown
## Description

Brief description of changes

## Changes

- List specific changes
- Each on new line

## Testing

- How to test
- What was tested

## Screenshots (if applicable)

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code formatted
- [ ] No breaking changes (or documented)
```
