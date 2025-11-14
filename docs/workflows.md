# Workflow System

This document details how n8n workflows orchestrate the agent lifecycle and implement the development process state machine.

## Overview

DevSlave uses **n8n workflows** as the orchestration layer for agent coordination. Workflows are triggered via webhooks and implement a phase-based state machine that routes work through specialized agents.

## Workflow Files

Located in `docker/n8n/workflows/`:

| Workflow                       | Purpose                         | Webhook Path         |
| ------------------------------ | ------------------------------- | -------------------- |
| Master Workflow                | Entry point and phase router    | `/webhook/master`    |
| Architect Agent Workflow       | System design and specification | `/webhook/architect` |
| Project Manager Agent Workflow | Ticket generation and planning  | `/webhook/pm`        |
| Dev Agent Workflow             | Feature implementation          | `/webhook/dev`       |
| QA Agent Workflow              | Testing and quality review      | `/webhook/qa`        |

## Master Workflow

The **Master Workflow** is the main orchestrator. It implements the project phase state machine and routes incoming requests to specialized agent workflows.

### Flow Diagram

```
┌──────────────────┐
│ Master Webhook   │ ← POST /webhook/master
│ (Trigger)        │   Body: { codebaseId, trigger?, ticketId? }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Get Project      │ ← GET /api/codebases/{codebaseId}
│ Phase            │   Returns: { phase, name, path, ... }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Project Phase    │ ← Switch on phase value
│ Router (Switch)  │
└────────┬─────────┘
         │
    ┌────┴────┬─────────┬───────────┐
    │         │         │           │
    ▼         ▼         ▼           ▼
  DESIGN  PLANNING  DEVELOPMENT  COMPLETED
    │         │         │           │
    ▼         ▼         ▼           ▼
 Architect   PM    Scan Tickets   No-op
 Agent     Agent       │
                       ▼
                 ┌──────────────┐
                 │ Next Ticket  │ ← Filter tickets by status
                 │ Router       │   Priority: OPEN > QA_CHANGES_REQUESTED
                 └──────┬───────┘
                        │
                   ┌────┴────┐
                   │         │
                   ▼         ▼
              Has Ticket  No Tickets
                   │         │
                   │         ▼
                   │    Transition to
                   │    COMPLETED Phase
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
           Status?   Status?
              │         │
           ▼  │      ▼  │
         OPEN QA_    │  │
           │  CHANGES│  │
           │  REQ    │  │
           │         │  │
           ▼         ▼  │
        Dev Agent  QA Agent
        Workflow   Workflow
```

### Node Descriptions

#### 1. Master Webhook

**Type:** `n8n-nodes-base.webhook`

Receives HTTP POST requests to trigger the workflow.

**Expected Payload:**

```json
{
    "codebaseId": "clx123...",
    "trigger": "user|auto",
    "ticketId": "FEAT-001" // Optional: specific ticket to process
}
```

**Configuration:**

- Path: `/webhook/master`
- Method: `POST`
- Response Mode: `On Received`
- Authentication: None (internal traffic only)

#### 2. Get Project Phase

**Type:** `n8n-nodes-base.httpRequest`

Fetches the current project phase from the API.

**Configuration:**

```javascript
{
  method: 'GET',
  url: 'http://app:3000/api/codebases/{{ $json.codebaseId }}',
  authentication: 'none'
}
```

**Response:**

```json
{
    "id": "clx123...",
    "name": "MyProject",
    "phase": "DEVELOPMENT",
    "setup": true,
    "path": "/app/dev/projects/myproject"
}
```

#### 3. Project Phase Router

**Type:** `n8n-nodes-base.switch`

Routes based on the project's current phase.

**Rules:**

```javascript
[
    { output: 0, value: "DESIGN" }, // → Architect Agent
    { output: 1, value: "PLANNING" }, // → PM Agent
    { output: 2, value: "DEVELOPMENT" }, // → Scan Tickets
    { output: 3, value: "COMPLETED" }, // → No-op
];
```

#### 4. Scan Tickets

**Type:** `n8n-nodes-base.httpRequest`

Retrieves all tickets for the codebase.

**Configuration:**

```javascript
{
  method: 'GET',
  url: 'http://app:3000/api/tickets/{{ $json.codebaseId }}/scan'
}
```

**Response:**

```json
[
    {
        "id": "clx456...",
        "ticketId": "FEAT-001",
        "status": "OPEN",
        "branchName": "feature/feat-001",
        "title": "Implement user authentication"
    }
    // ...
]
```

#### 5. Next Ticket Router

**Type:** `n8n-nodes-base.switch`

Selects the next ticket to process based on status and priority.

**Logic:**

```javascript
// Priority order:
// 1. OPEN tickets (new work)
// 2. QA_CHANGES_REQUESTED tickets (rework)
// 3. If none: project complete

const openTickets = $input.all().filter((t) => t.json.status === "OPEN");

const qaReworkTickets = $input.all().filter((t) => t.json.status === "QA_CHANGES_REQUESTED");

if (openTickets.length > 0) {
    return { output: 0, data: openTickets[0] }; // → Dev Agent
} else if (qaReworkTickets.length > 0) {
    return { output: 0, data: qaReworkTickets[0] }; // → Dev Agent
} else {
    return { output: 1 }; // → Transition to COMPLETED
}
```

#### 6. Trigger Agent Nodes

**Type:** `n8n-nodes-base.httpRequest`

Each "Trigger X Agent" node calls the respective agent workflow.

**Example (Trigger Dev Agent):**

```javascript
{
  method: 'POST',
  url: 'http://n8n:5678/webhook/dev',
  body: {
    codebaseId: '{{ $json.codebaseId }}',
    ticketId: '{{ $json.ticketId }}',
    branchName: '{{ $json.branchName }}',
    executionId: '{{ $workflow.executionId }}'
  }
}
```

## Agent Workflows

All specialized agent workflows (Architect, PM, Dev, QA) follow a **common pattern** with role-specific customizations.

### Common Agent Workflow Pattern

```
Webhook Trigger
  ↓
Prepare Payload (Set/Code node)
  ↓
Switch to Git Branch (SSH)
  ↓
Launch Agent (HTTP POST to API)
  ↓
┌─────────────────────────┐
│     Polling Loop        │
│  ┌──────────────────┐   │
│  │ Wait (30s)       │   │
│  └────────┬─────────┘   │
│           ↓             │
│  ┌──────────────────┐   │
│  │ Ping Agent       │   │
│  │ (GET /status)    │   │
│  └────────┬─────────┘   │
│           ↓             │
│  ┌──────────────────┐   │
│  │ Agent Status     │   │
│  │ Switch           │   │
│  └────────┬─────────┘   │
│           │             │
│  ┌────────┴────────┐    │
│  │                 │    │
│  ▼                 ▼    │
│ RUNNING       COMPLETED │
│  │              / FAILED│
│  │                 │    │
│  └─────(loop)      │    │
└────────────────────┼────┘
                     ↓
            Agent Complete
                     ↓
            Commit Work (SSH)
                     ↓
            Update Phase/Status (HTTP)
                     ↓
            Trigger Master Again
```

### Example: Dev Agent Workflow

#### 1. Dev Webhook

**Type:** `n8n-nodes-base.webhook`

**Expected Payload:**

```json
{
    "codebaseId": "clx123...",
    "ticketId": "FEAT-001",
    "branchName": "feature/feat-001",
    "executionId": "12345"
}
```

#### 2. Dev Prompt (Prepare Payload)

**Type:** `n8n-nodes-base.set`

Constructs the agent prompt from the ticket details.

**Code:**

```javascript
const codebase = $json.codebase;
const ticket = $json.ticket;

const systemPrompt = `You are an expert senior software engineer.
Please read .agent/onboarding/engineer.md for important context.`;

const taskPrompt = `
# Task: ${ticket.title}

${ticket.description}

## Branch
Work on branch: ${ticket.branchName}

## Acceptance Criteria
- Feature must be implemented
- Tests must pass
- Code must follow project conventions
`;

return {
    codebaseId: codebase.id,
    codebasePath: codebase.path,
    ticketId: ticket.ticketId,
    branchName: ticket.branchName,
    systemPrompt,
    taskPrompt,
    role: "dev",
    executionId: $workflow.executionId,
};
```

#### 3. Switch to Git Branch

**Type:** `n8n-nodes-base.ssh`

Checks out the ticket's feature branch.

**Configuration:**

```javascript
{
  host: 'app',
  port: 2222,
  username: 'root',
  password: 'dev',
  command: `
    cd {{ $json.codebasePath }} && \
    git fetch origin && \
    git checkout -b {{ $json.branchName }} || git checkout {{ $json.branchName }}
  `
}
```

#### 4. Launch Dev Agent

**Type:** `n8n-nodes-base.httpRequest`

Calls the API to spawn the agent.

**Configuration:**

```javascript
{
  method: 'POST',
  url: 'http://app:3000/api/agent/start',
  body: {
    codebaseId: '{{ $json.codebaseId }}',
    role: '{{ $json.role }}',
    prompt: '{{ $json.systemPrompt }}\n\n{{ $json.taskPrompt }}',
    executionId: '{{ $json.executionId }}',
    data: {
      ticketId: '{{ $json.ticketId }}',
      branchName: '{{ $json.branchName }}'
    }
  }
}
```

**Response:**

```json
{
    "agentId": "clx789...",
    "tmuxSession": "agent_1699999999_dev",
    "status": "LAUNCHED",
    "logFile": "/tmp/agent_clx789.log"
}
```

#### 5. Dev Poll Delay

**Type:** `n8n-nodes-base.wait`

Waits before first status check.

**Configuration:**

```javascript
{
  unit: 'seconds',
  amount: 30
}
```

#### 6. Ping Dev Agent

**Type:** `n8n-nodes-base.httpRequest`

Polls agent status.

**Configuration:**

```javascript
{
  method: 'GET',
  url: 'http://app:3000/api/agent/status/{{ $json.agentId }}'
}
```

**Response:**

```json
{
    "status": "RUNNING",
    "progress": "Implementing authentication logic...",
    "lastActivity": "2024-11-14T10:30:00Z"
}
```

#### 7. Dev Agent Status (Switch)

**Type:** `n8n-nodes-base.switch`

Routes based on agent status.

**Rules:**

```javascript
[
    { output: 0, value: "RUNNING" }, // → Loop back to wait
    { output: 1, value: "COMPLETED" }, // → Commit work
    { output: 2, value: "FAILED" }, // → Error handler
];
```

#### 8. Commit Dev Work

**Type:** `n8n-nodes-base.ssh`

Commits agent changes and pushes to origin.

**Configuration:**

```javascript
{
    command: `
    cd {{ $json.codebasePath }} && \
    git add . && \
    git commit -m "feat: {{ $json.ticketId }} - ${$json.ticket.title}" && \
    git push origin {{ $json.branchName }}
  `;
}
```

#### 9. Update Ticket Status

**Type:** `n8n-nodes-base.httpRequest`

Marks ticket as ready for QA.

**Configuration:**

```javascript
{
  method: 'PATCH',
  url: 'http://app:3000/api/tickets/{{ $json.ticketId }}',
  body: {
    status: 'QA_REVIEW'
  }
}
```

#### 10. Trigger Master Workflow

**Type:** `n8n-nodes-base.httpRequest`

Recursively calls master workflow to process next ticket.

**Configuration:**

```javascript
{
  method: 'POST',
  url: 'http://n8n:5678/webhook/master',
  body: {
    codebaseId: '{{ $json.codebaseId }}',
    trigger: 'auto'
  }
}
```

### QA Agent Workflow Differences

The QA workflow is similar but includes additional decision points:

```
... (same polling loop) ...
      ↓
Agent Complete
      ↓
┌─────────────────┐
│ QA Decision     │ ← Agent outputs: APPROVE or REQUEST_CHANGES
│ (Switch)        │
└─────┬───────────┘
      │
  ┌───┴───┐
  ▼       ▼
APPROVE  REQUEST_CHANGES
  │       │
  ▼       ▼
Merge    Update Ticket Status
Branch   (QA_CHANGES_REQUESTED)
  │       │
  ▼       └──► Trigger Master
Close Ticket
  │
  ▼
Trigger Master
```

**QA Agent Output Format:**

The QA agent must output a decision in its final log entry:

```json
{
    "type": "complete",
    "decision": "APPROVE",
    "summary": "All tests pass, code quality is good"
}
```

or:

```json
{
    "type": "complete",
    "decision": "REQUEST_CHANGES",
    "issues": ["Missing error handling in login.ts", "Tests do not cover edge cases"]
}
```

## Phase Transitions

Workflows update the project phase at key milestones.

### Transition Rules

| Current Phase | Condition          | Next Phase  |
| ------------- | ------------------ | ----------- |
| DESIGN        | Architect complete | PLANNING    |
| PLANNING      | PM complete        | DEVELOPMENT |
| DEVELOPMENT   | All tickets closed | COMPLETED   |
| COMPLETED     | Manual reset       | DESIGN      |

### Transition Mechanism

**HTTP Request to API:**

```javascript
{
  method: 'POST',
  url: 'http://app:3000/api/codebases/{{ $json.codebaseId }}/phase',
  body: {
    phase: 'PLANNING'
  }
}
```

**Handler Implementation:**

```typescript
// updatePhase.handler.ts
export const updatePhaseHandler = async (codebaseId: string, phase: ProjectPhase) => {
    const codebase = await prisma.codebase.update({
        where: { id: codebaseId },
        data: { phase },
    });

    await recordEvent({
        type: "phase.transition",
        data: { codebaseId, from: codebase.phase, to: phase },
    });

    return codebase;
};
```

## Error Handling

### Agent Failure

If an agent enters `FAILED` status, the workflow triggers an error handler.

**Error Handler Node:**

```javascript
{
  type: 'n8n-nodes-base.stopAndError',
  message: 'Agent {{ $json.role }} failed for ticket {{ $json.ticketId }}',
  errorOutput: 'error-output'
}
```

**Manual Intervention Required:**

1. Inspect agent log file
2. Fix underlying issue
3. Reset agent status or restart workflow

### Infinite Loop Protection

Workflows include a **max iterations** safeguard.

**Implementation:**

```javascript
// In polling loop
const iterations = $json.iterations || 0;

if (iterations > 100) {
    throw new Error("Agent exceeded max polling iterations (50 minutes)");
}

return {
    ...item.json,
    iterations: iterations + 1,
};
```

### Webhook Timeout

n8n webhooks have a **120-second timeout** for response mode `On Received`.

**Solution:** Use response mode `Last Node` and respond immediately:

```javascript
// Respond to Webhook node
{
  respondWith: 'json',
  responseBody: {
    message: 'Workflow started',
    executionId: '{{ $workflow.executionId }}'
  }
}
```

## Testing Workflows

### Manual Testing

1. Import workflow JSON into n8n
2. Activate workflow
3. Use CLI or curl to trigger webhook
4. Monitor execution in n8n UI

**Example curl:**

```bash
curl -X POST http://localhost:5678/webhook/master \
    -H "Content-Type: application/json" \
    -d '{"codebaseId": "clx123...", "trigger": "test"}'
```

### Debugging

**n8n Execution View:**

- Shows each node's input/output
- Highlights failed nodes
- Provides error messages

**Agent Logs:**

```bash
# Tail agent log in real-time
docker exec -it devslave-app-1 tail -f /tmp/agent_ < id > .log
```

**Database State:**

```bash
# Check agent status
docker exec -it devslave-app-1 npx prisma studio
# Navigate to Agent table
```

## Workflow Variables

Common variables used across workflows:

| Variable                | Source          | Example                       |
| ----------------------- | --------------- | ----------------------------- |
| `$json.codebaseId`      | Webhook payload | `clx123...`                   |
| `$json.ticketId`        | Webhook/DB      | `FEAT-001`                    |
| `$json.branchName`      | Ticket          | `feature/feat-001`            |
| `$workflow.executionId` | n8n runtime     | `12345`                       |
| `$json.agentId`         | API response    | `clx789...`                   |
| `$json.codebasePath`    | DB query        | `/app/dev/projects/myproject` |

## Performance Optimization

### Parallel Execution

n8n supports parallel node execution:

```
┌─────────┐
│ Trigger │
└────┬────┘
     │
  ┌──┴───┐
  │      │
  ▼      ▼
Node1  Node2  ← Execute in parallel
  │      │
  └──┬───┘
     ▼
  Merge
```

**Example Use Case:** Trigger multiple agent workflows simultaneously.

### Queue Workers

Configure multiple n8n workers for parallel workflow execution:

```yaml
# docker-compose.yml
services:
  n8n-worker:
    <<: *shared
    command: worker
    deploy:
      replicas: 3  # 3 concurrent workers
```

### Database Connection Pooling

Prisma automatically manages connection pooling. Default pool size: 10 connections.

**Override in `.env`:**

```
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"
```

## Advanced Patterns

### Conditional Agent Selection

Route to different agent types based on ticket metadata:

```javascript
// In ticket router
const ticket = $json;

if (ticket.tags.includes("architecture")) {
    return { output: 0 }; // → Architect
} else if (ticket.tags.includes("refactor")) {
    return { output: 1 }; // → Senior Dev
} else {
    return { output: 2 }; // → Junior Dev
}
```

### Human-in-the-Loop

Add manual approval nodes:

```
Agent Complete
  ↓
Send Notification (Email/Slack)
  ↓
Wait for Webhook (Manual Trigger)
  ↓
Approval Switch
  ├─► Approved: Merge and Continue
  └─► Rejected: Request Changes
```

### Multi-Agent Collaboration

Implement pair programming:

```
Dev Agent 1 (Implementation)
  ↓
Dev Agent 2 (Code Review)
  ↓
QA Agent (Testing)
```

## Further Reading

- [Architecture Deep Dive](architecture.md)
- [Agent Lifecycle](agent-lifecycle.md)
- [Development Guide](development.md)
