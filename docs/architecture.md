# Architecture Deep Dive

This document provides a comprehensive overview of DevSlave's architecture, design decisions, and component interactions.

## System Overview

DevSlave is built on a **microservices-inspired architecture** using Docker Compose to orchestrate multiple specialized services. The core innovation is the **agent runtime environment**—a sandboxed container where AI agents can execute arbitrary commands safely while being guided by structured workflows.

## Core Components

### 1. Express API Server (`src/server.ts`)

The API server is the **control plane** for the entire system.

**Responsibilities:**

- Agent lifecycle management (start, stop, status polling)
- Codebase CRUD operations
- Ticket scanning and management
- Event recording for observability
- Health checks and monitoring

**Key Endpoints:**

| Route                           | Method | Purpose                  |
| ------------------------------- | ------ | ------------------------ |
| `/health`                       | GET    | Service health check     |
| `/api/codebases`                | GET    | List all projects        |
| `/api/codebases/:id`            | GET    | Get project details      |
| `/api/agent/start`              | POST   | Launch new agent         |
| `/api/agent/status/:id`         | GET    | Poll agent status        |
| `/api/agent/kill/:id`           | POST   | Terminate agent          |
| `/api/tickets/:codebaseId/scan` | GET    | Scan project for tickets |

**Architecture Pattern:**

```
Request → Controller → Handler → Prisma/External Service → Response
```

Example flow:

```typescript
// routes.ts
router.post("/api/agent/start", agentController.startAgent);

// agent.controller.ts
export const startAgent = async (req, res) => {
    const result = await startAgentHandler(req.body);
    res.json(result);
};

// startAgent.handler.ts
export const startAgentHandler = async (data) => {
    // Business logic: validate, create DB record, spawn tmux session
    return { agentId, sessionId, status };
};
```

**Why Express?**

- Lightweight and fast
- Middleware ecosystem (CORS, JSON parsing)
- Easy integration with Prisma
- Well-understood by most developers

### 2. n8n Workflow Engine

n8n orchestrates the **agent coordination layer**. It implements a state machine that routes work between specialized agents based on project phase.

**Workflow Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Master Workflow                          │
│  ┌────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │  Webhook   │────►│ Get Project  │────►│ Phase Router │  │
│  │  Trigger   │     │    Phase     │     │   (Switch)   │  │
│  └────────────┘     └──────────────┘     └──────┬───────┘  │
│                                                   │          │
│  ┌───────────────────────────────────────────────┘          │
│  │                                                           │
│  ▼              ▼              ▼              ▼              │
│ DESIGN      PLANNING      DEVELOPMENT     COMPLETED          │
│  │              │              │                             │
│  ▼              ▼              ▼                             │
│ Architect      PM          Scan Tickets                      │
│ Workflow    Workflow           │                             │
│                                 ▼                             │
│                          ┌─────────────┐                     │
│                          │Ticket Router│                     │
│                          └──────┬──────┘                     │
│                                 │                             │
│                     ┌───────────┴───────────┐               │
│                     ▼                       ▼                │
│                  Dev Agent              QA Agent             │
│                  Workflow               Workflow             │
└─────────────────────────────────────────────────────────────┘
```

**Master Workflow Nodes:**

1. **Master Webhook** - Entry point (`/webhook/master`)
2. **Get Project Phase** - HTTP request to API
3. **Project Phase Router** - Switch node routing by phase:
    - `DESIGN` → Trigger Architect
    - `PLANNING` → Trigger PM
    - `DEVELOPMENT` → Scan Tickets → Route to Dev/QA
    - `COMPLETED` → No-op

**Agent Workflow Pattern:**

Each specialized workflow (Architect, PM, Dev, QA) follows this structure:

```
Webhook Trigger
  ↓
Prepare Environment (Set variables)
  ↓
Checkout Git Branch (SSH)
  ↓
Launch Agent (HTTP → API)
  ↓
┌─────────────────┐
│  Polling Loop   │
│  ┌──────────┐   │
│  │  Wait    │   │
│  │  (30s)   │   │
│  └────┬─────┘   │
│       ↓         │
│  ┌──────────┐   │
│  │  Ping    │   │
│  │  Agent   │   │
│  └────┬─────┘   │
│       ↓         │
│  ┌──────────┐   │
│  │  Status  │   │
│  │  Switch  │   │
│  └────┬─────┘   │
│       │         │
└───────┼─────────┘
        ↓
   COMPLETED / FAILED
        ↓
  Commit Work (SSH)
        ↓
  Update Phase (HTTP)
```

**Why n8n?**

- Visual workflow design (non-programmers can modify)
- Webhook-based triggering (async execution)
- Built-in polling and retry logic
- Queue-based execution (via Redis)
- SSH node for container command execution

### 3. Agent Runtime (tmux + Codex)

Agents run as **foreground processes in named tmux sessions** within the app container.

**Execution Flow:**

```bash
# src/scripts/launch-agent.sh

1. Query database for codebase path
2. Create unique tmux session name: "agent_<timestamp>_<codebaseId>"
3. Set up session log file: /tmp/agent_ < id > .log
4. Launch tmux session with pipe-pane logging
5. Execute Codex CLI in foreground within tmux
6. Store tmux session name + log path in DB
7. Return session details to caller
```

**Why tmux?**

- **Session persistence** - Agents survive network disconnections
- **Log capture** - `pipe-pane` writes all output to file
- **Interactive access** - Can attach to watch agents work
- **Process isolation** - Each agent in own namespace

**Log Format:**

Agents output JSONL (JSON Lines) for structured logging:

```json
{"type": "thinking", "content": "I need to create a new component..."}
{"type": "command", "content": "npm install react"}
{"type": "output", "content": "added 1 package"}
{"type": "file_edit", "file": "src/App.tsx", "action": "create"}
{"type": "complete", "summary": "Feature implemented successfully"}
```

The watchdog handler (`watchAgent.handler.ts`) tails this log to determine:

- Current agent activity
- Progress milestones
- Completion status
- Error conditions

**Codex Configuration:**

```bash
# Codex is installed globally in container
npm install -g @openai/codex

# Configured via environment
CODEX_OSS_BASE_URL=http://ollama:11434 # Or OpenAI API

# System prompts injected at launch
--system-prompt "$(cat src/prompts/system/dev.md)"
```

### 4. Database Layer (Prisma + PostgreSQL)

**Schema Design:**

```prisma
Agent {
  id          String      # CUID
  executionId String      # n8n execution ID
  sessionId   String?     # Codex session ID
  tmuxSession String?     # tmux session name
  codebaseId  String?     # FK to Codebase
  role        String?     # architect|pm|dev|qa
  logFile     String?     # Path to JSONL log
  prompt      String?     # Full system prompt
  model       String      # LLM model name
  data        Json?       # Flexible metadata
  status      AgentStatus # PREPARING|LAUNCHED|RUNNING|COMPLETED|FAILED
}

Codebase {
  id        String       # CUID
  name      String       # Display name
  path      String       # Absolute path in container
  setup     Boolean      # Initialization complete
  data      Json?        # Project metadata
  phase     ProjectPhase # DESIGN|PLANNING|DEVELOPMENT|COMPLETED
  active    Boolean      # Soft delete flag
}

Ticket {
  id          String       # CUID
  codebaseId  String       # FK to Codebase
  ticketId    String       # User-facing ID (e.g., "FEAT-001")
  branchName  String       # Git branch for this work
  title       String
  description String?
  ticketFile  String       # Path to markdown file
  status      TicketStatus # OPEN|IN_PROGRESS|QA_REVIEW|...
}

Events {
  id        String       # CUID
  parentId  String?      # For nested events
  type      String       # Event type (agent.started, etc)
  data      Json?        # Event payload
  timestamp DateTime
}
```

**Why Prisma?**

- Type-safe database access
- Auto-generated migrations
- Built-in connection pooling
- Great TypeScript integration

**Why PostgreSQL?**

- JSONB support for flexible schemas
- Rock-solid reliability
- n8n native support
- Great Docker image

### 5. Docker Container Environment

The `app` container is the **agent execution environment**. It's designed to be a full-featured development workspace.

**Installed Toolchains:**

- **Node.js 22** (via nvm)
- **Python 3** + uv (fast pip alternative)
- **PHP 8.4** + Composer (Laravel support)
- **Go 1.21**
- **Rust** (latest stable)
- **Git** + pre-commit hooks
- **Gitleaks** (secret scanning)
- **tmux** (session management)
- **SSH server** (for n8n SSH node)

**Directory Layout:**

```
/app/
├── agent/              # Project source (bind mount from host)
│   ├── src/
│   ├── prisma/
│   ├── docker/
│   └── node_modules/  # Named volume (not bind-mounted)
│
└── dev/                # Agent workspace (persistent volume)
    ├── projects/       # Cloned/generated codebases
    ├── temp/           # Scratch space
    └── outputs/        # Agent artifacts
```

**Volume Strategy:**

```yaml
volumes:
    # Project source (editable from host)
    - .:/app/agent

    # Dependencies (fast container I/O)
    - app_node_modules:/app/agent/node_modules

    # Agent workspace (persistent between restarts)
    - dev_data:/app/dev

    # Codex config (seeded from host, isolated in container)
    - codex_data:/root/.codex
    - ${HOME}/.codex:/seed/.codex:ro
```

**Why This Layout?**

- **Host editing** - Code changes immediately visible
- **Fast deps** - node_modules in named volume (not bind mount)
- **Persistent work** - Agent output survives container restarts
- **Isolated config** - Codex settings don't pollute host

### 6. Supporting Services

#### Redis

- Queue backend for n8n
- Enables distributed worker execution
- In-memory caching (if needed)

#### Ollama

- Local LLM inference
- Reduces OpenAI API costs
- Falls back to OpenAI if needed
- Models stored in host `~/.ollama`

## Data Flow Examples

### Starting an Agent

```
1. CLI: devs (user selects "Start Agent Workflow")
   └─► HTTP POST to n8n webhook: /webhook/master
       Body: { codebaseId: "xyz", trigger: "user" }

2. n8n Master Workflow receives webhook
   └─► HTTP GET to API: /api/codebases/xyz
       Response: { phase: "DEVELOPMENT", ... }

3. n8n Phase Router evaluates phase
   └─► If DEVELOPMENT:
       └─► HTTP GET to API: /api/tickets/xyz/scan
           Response: [{ id: "abc", status: "OPEN", ... }]

4. n8n Ticket Router selects next ticket
   └─► Calls Dev Agent Workflow with ticket details

5. Dev Agent Workflow:
   a. SSH to app container: git checkout -b feature/abc
   b. HTTP POST to API: /api/agent/start
      Body: { codebaseId: "xyz", role: "dev", ticket: {...} }
   c. API calls startAgentHandler:
      - Creates Agent record (status: PREPARING)
      - Calls launch-agent.sh script
      - Script creates tmux session
      - Script launches Codex CLI
      - Returns { agentId, tmuxSession, logFile }
   d. Updates Agent record (status: LAUNCHED)
   e. Enters polling loop:
      - Wait 30s
      - HTTP GET to API: /api/agent/status/{agentId}
      - If RUNNING: continue loop
      - If COMPLETED: proceed to commit
   f. SSH to app container: git add . && git commit

6. n8n triggers Master Workflow again (recursive)
```

### Monitoring an Agent

```
1. CLI calls watchAgent.handler.ts
   └─► Queries Agent record for logFile path
       └─► Uses docker exec or SSH to tail log file
           └─► Parses JSONL events
               └─► Displays formatted output to user
```

## Design Decisions

### Why Separate CLI and API?

**Original Approach:** Trigger workflows directly from n8n UI  
**Problem:** Can't wait for async responses, hard to script

**Current Approach:** CLI → Webhook → n8n  
**Benefits:**

- CLI can trigger workflows via HTTP
- User-friendly interface
- Scriptable/automatable
- Better error handling

### Why tmux Instead of Background Processes?

**Alternatives Considered:**

- `nohup codex &` - No log capture, hard to monitor
- Docker exec - Session dies on disconnect
- Screen - Less ubiquitous than tmux

**tmux Advantages:**

- Built-in logging via `pipe-pane`
- Can attach/detach for debugging
- Named sessions for identification
- Process survives SSH disconnects

### Why n8n Instead of Custom Orchestration?

**Alternatives Considered:**

- Bull/BullMQ queues - Too much code
- Temporal - Overkill for our scale
- Custom state machine - Reinventing wheel

**n8n Advantages:**

- Visual workflow editing
- Built-in nodes (HTTP, SSH, Switch, Wait)
- Webhook triggers
- Free and open-source
- Self-hosted (no SaaS dependency)

### Why Not Use Docker Compose for Agent Isolation?

**Considered:** Each agent in separate container  
**Rejected Because:**

- Overhead of spinning up/down containers
- Harder to debug (no persistent tmux)
- Network complexity
- Volume management nightmare

**Current Approach:**

- All agents in same container
- tmux provides isolation
- Shared filesystem for efficiency
- Easy to attach and debug

## Performance Considerations

### Database Queries

- **No N+1 queries** - Use Prisma's `include` for relations
- **Indexed fields** - `codebaseId`, `status`, `ticketId`
- **Connection pooling** - Prisma handles automatically

### Docker Volume Performance

- **Named volumes for deps** - Much faster than bind mounts
- **Bind mount only source** - Direct host editing
- **tmpfs for logs** - Fast writes, don't need persistence

### Agent Concurrency

- **Multiple agents per container** - Shared resources
- **tmux prevents interference** - Separate sessions
- **Database tracks state** - No race conditions
- **n8n queues work** - Redis-backed job queue

## Security Model

### Container Isolation

- **No privileged mode** - Standard user permissions
- **Limited host access** - Only bind-mounted dirs
- **Network isolation** - Inter-container communication only
- **Read-only where possible** - Codex seed volume

### Secret Management

- **Environment variables** - Never in code
- **.env excluded from git** - Via .gitignore
- **Gitleaks scanning** - Pre-commit hook
- **SSH keys in volume** - Not bind-mounted

### Agent Safety

- **Sandboxed execution** - Can't escape container
- **No sudo access** - Run as non-root where possible
- **Git hooks** - Prevent committing secrets
- **Pre-commit validation** - Linting, formatting

## Observability

### Logging

- **Structured events** - JSONL format
- **Event sourcing** - Events table for audit trail
- **Agent logs** - Per-session log files
- **Docker logs** - Container stdout/stderr

### Monitoring

- **Health endpoints** - `/health` for uptime checks
- **Agent status polling** - Real-time progress tracking
- **Database state** - Single source of truth
- **n8n execution history** - Workflow debugging

### Debugging

- **Attach to tmux** - `docker exec -it app tmux attach -t <session>`
- **Read logs** - `docker exec app cat /tmp/agent_<id>.log`
- **Prisma Studio** - Visual database browser
- **n8n UI** - Workflow execution inspector

## Scalability

### Current Limitations

- **Single-server** - No distributed setup (yet)
- **Shared container** - All agents in one environment
- **PostgreSQL** - Single database instance
- **n8n workers** - Limited to configured worker count

### Future Scaling Options

1. **Horizontal Scaling**
    - Multiple app containers (load balanced)
    - Shared PostgreSQL + Redis
    - n8n worker pool

2. **Database Sharding**
    - Separate DB per project
    - Federated queries

3. **Agent Containers**
    - One container per agent
    - Kubernetes orchestration
    - Auto-scaling based on queue depth

4. **Distributed Storage**
    - S3 for logs and artifacts
    - NFS for shared volumes

## Technology Choices Summary

| Component     | Technology   | Why                             |
| ------------- | ------------ | ------------------------------- |
| API           | Express      | Fast, simple, well-known        |
| Database      | PostgreSQL   | JSONB, reliability, n8n support |
| ORM           | Prisma       | Type safety, migrations         |
| Orchestration | n8n          | Visual, webhooks, open-source   |
| Agent Runtime | tmux + Codex | Logging, persistence, isolation |
| Container     | Docker       | Reproducibility, portability    |
| Language      | TypeScript   | Type safety, Node.js ecosystem  |
| Testing       | Jest         | Fast, full-featured, standard   |
| CLI           | Inquirer     | Interactive, user-friendly      |

## Further Reading

- [Workflow System Details](workflows.md)
- [Agent Lifecycle](agent-lifecycle.md)
- [Development Guide](development.md)
- [Docker Setup](docker-setup.md)
