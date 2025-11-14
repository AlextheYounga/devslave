# Agent Lifecycle

This document explains how agents are created, executed, monitored, and terminated within the DevSlave system.

## Overview

An **agent** is a Codex-powered AI that executes within a tmux session inside the Docker container. Each agent has a dedicated role (architect, PM, dev, QA) and works on a specific task (design, planning, ticket implementation, testing).

## Lifecycle Stages

```
┌──────────────────────────────────────────────────────────┐
│                     Agent Lifecycle                       │
└──────────────────────────────────────────────────────────┘

1. PREPARING   →  2. LAUNCHED  →  3. RUNNING  →  4. COMPLETED
                        ↓                              ↓
                    (error)                        (error)
                        ↓                              ↓
                    5. FAILED  ←──────────────────────┘
```

### 1. PREPARING

**Trigger:** n8n workflow calls `/api/agent/start`

**Actions:**

1. Validate request payload
2. Create `Agent` database record with status `PREPARING`
3. Query `Codebase` for project path
4. Generate unique identifiers:
    - Agent ID (CUID)
    - tmux session name: `agent_<timestamp>_<role>_<codebaseId>`
    - Log file path: `/tmp/agent_<agentId>.log`

**Database State:**

```typescript
{
  id: "clx123abc",
  status: "PREPARING",
  role: "dev",
  codebaseId: "clx456def",
  executionId: "12345",
  sessionId: null,
  tmuxSession: null,
  logFile: null,
  prompt: "You are an expert senior software engineer...",
  model: "gpt-4",
  data: {
    ticketId: "FEAT-001",
    branchName: "feature/feat-001"
  },
  createdAt: "2024-11-14T10:00:00Z"
}
```

**Duration:** < 1 second

### 2. LAUNCHED

**Trigger:** `launch-agent.sh` script execution

**Actions:**

1. Create tmux session with configured name
2. Set up `pipe-pane` logging to capture all output
3. Launch Codex CLI in foreground within tmux
4. Capture tmux session details and foreground PID
5. Update `Agent` record with session info

**Script Execution:**

```bash
#!/usr/bin/env bash
# src/scripts/launch-agent.sh

codebase_id=$1
agent_id=$2

# Get codebase path from database
codebase_path=$(db_query "SELECT path FROM codebases WHERE id = '$codebase_id'")

# Get tmux session name
tmux_session=$(db_query "SELECT \"tmuxSession\" FROM agents WHERE id = '$agent_id'")

# Create log file
log_file="/tmp/agent_${agent_id}.log"
touch "$log_file"

# Launch tmux session with logging
tmux new-session -d -s "$tmux_session" -c "$codebase_path"
tmux pipe-pane -t "$tmux_session" -o "cat >> $log_file"

# Get system prompt
prompt=$(db_query "SELECT prompt FROM agents WHERE id = '$agent_id'")

# Launch Codex in tmux session
tmux send-keys -t "$tmux_session" \
    "codex --model gpt-4 --system-prompt '$prompt' --output-format jsonl" \
    C-m

# Capture session PID
session_pid=$(tmux list-panes -t "$tmux_session" -F '#{pane_pid}')

# Update database
db_exec "UPDATE agents SET 
  status = 'LAUNCHED',
  \"sessionId\" = '$session_pid',
  \"logFile\" = '$log_file'
  WHERE id = '$agent_id'"

echo "$tmux_session"
```

**Database State:**

```typescript
{
  // ... previous fields
  status: "LAUNCHED",
  sessionId: "98765",  // PID
  tmuxSession: "agent_1699999999_dev_clx456def",
  logFile: "/tmp/agent_clx123abc.log",
  updatedAt: "2024-11-14T10:00:01Z"
}
```

**Duration:** 1-2 seconds

**What Happens Next:**

- n8n workflow enters polling loop
- Waits 30 seconds before first status check
- Agent begins executing autonomously

### 3. RUNNING

**Trigger:** Agent starts processing task

**Detection:**

- First JSONL log entry appears in log file
- Status check detects activity

**Monitoring:**

The `watchAgent` handler continuously monitors agent progress:

```typescript
// src/handlers/watchAgent.handler.ts

export const watchAgentHandler = async (agentId: string) => {
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { codebase: true },
    });

    if (!agent?.logFile) {
        throw new Error("Agent log file not found");
    }

    // Read log file (JSONL format)
    const logContent = await fs.readFile(agent.logFile, "utf-8");
    const events = logContent
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

    // Check for completion markers
    const completionEvent = events.find((e) => e.type === "complete");
    const errorEvent = events.find((e) => e.type === "error");

    if (completionEvent) {
        return { status: "COMPLETED", events };
    }

    if (errorEvent) {
        return { status: "FAILED", events, error: errorEvent.message };
    }

    // Still running
    const lastEvent = events[events.length - 1];
    return {
        status: "RUNNING",
        progress: lastEvent?.content || "Working...",
        lastActivity: new Date(lastEvent?.timestamp),
        events,
    };
};
```

**JSONL Log Format:**

```jsonl
{"type":"thinking","content":"I need to implement user authentication","timestamp":"2024-11-14T10:00:05Z"}
{"type":"command","content":"npm install bcrypt jsonwebtoken","timestamp":"2024-11-14T10:00:10Z"}
{"type":"output","content":"added 2 packages","timestamp":"2024-11-14T10:00:15Z"}
{"type":"file_edit","file":"src/auth.ts","action":"create","timestamp":"2024-11-14T10:00:20Z"}
{"type":"file_edit","file":"src/auth.ts","action":"write","content":"...","timestamp":"2024-11-14T10:00:25Z"}
{"type":"test","command":"npm test","result":"pass","timestamp":"2024-11-14T10:05:00Z"}
{"type":"complete","summary":"Authentication implemented successfully","timestamp":"2024-11-14T10:05:05Z"}
```

**Status Polling:**

n8n workflow polls every 30 seconds:

```javascript
// n8n workflow loop
Wait 30s
  ↓
GET /api/agent/status/{agentId}
  ↓
Response: { status: "RUNNING", progress: "..." }
  ↓
If RUNNING: Loop back to Wait
If COMPLETED/FAILED: Exit loop
```

**API Endpoint:**

```typescript
// src/controllers/agent.controller.ts

export const getAgentStatus = async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const status = await getAgentStatusHandler(agentId);
    res.json(status);
};

// src/handlers/getAgentStatus.handler.ts

export const getAgentStatusHandler = async (agentId: string) => {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });

    if (!agent) {
        throw new Error("Agent not found");
    }

    // Check if agent is still alive
    const isAlive = await checkTmuxSessionAlive(agent.tmuxSession);

    if (!isAlive && agent.status === "RUNNING") {
        // Agent died unexpectedly
        await prisma.agent.update({
            where: { id: agentId },
            data: { status: "FAILED" },
        });
        return { status: "FAILED", error: "Agent session terminated unexpectedly" };
    }

    // Parse log file for progress
    const watchResult = await watchAgentHandler(agentId);

    // Update status if changed
    if (watchResult.status !== agent.status) {
        await prisma.agent.update({
            where: { id: agentId },
            data: { status: watchResult.status as AgentStatus },
        });
    }

    return watchResult;
};
```

**Duration:** Variable (5 minutes to 2 hours depending on task complexity)

### 4. COMPLETED

**Trigger:** Agent outputs completion event

**Detection:**

- Log file contains `{"type":"complete",...}` entry
- Status polling detects completion
- n8n workflow exits polling loop

**Actions:**

1. **Update Database:**

```typescript
await prisma.agent.update({
    where: { id: agentId },
    data: {
        status: "COMPLETED",
        updatedAt: new Date(),
    },
});
```

2. **Record Event:**

```typescript
await recordEvent({
    type: "agent.completed",
    data: {
        agentId,
        role: agent.role,
        codebaseId: agent.codebaseId,
        duration: Date.now() - agent.createdAt.getTime(),
    },
});
```

3. **Workflow Continues:**

```javascript
// n8n workflow
Commit Work (SSH)
  ↓
Update Phase/Status (HTTP)
  ↓
Trigger Next Workflow (HTTP)
```

4. **Cleanup tmux Session:**

```bash
# Optional: Keep for debugging or kill immediately
tmux kill-session -t "$tmux_session"
```

**Database State:**

```typescript
{
  // ... previous fields
  status: "COMPLETED",
  updatedAt: "2024-11-14T10:30:00Z"
}
```

### 5. FAILED

**Triggers:**

- Agent exits with error code
- tmux session terminates unexpectedly
- Agent outputs error event
- Timeout (exceeded max iterations)

**Detection:**

Multiple failure modes:

1. **Error Event in Log:**

```jsonl
{
    "type": "error",
    "message": "Failed to install dependencies",
    "timestamp": "2024-11-14T10:05:00Z"
}
```

2. **tmux Session Dead:**

```bash
tmux has-session -t "$tmux_session" 2> /dev/null
# Exit code 1 = session doesn't exist
```

3. **Timeout:**

```javascript
// n8n workflow
if (iterations > 100) {
    // 50 minutes
    throw new Error("Agent timeout");
}
```

**Actions:**

1. **Update Database:**

```typescript
await prisma.agent.update({
    where: { id: agentId },
    data: {
        status: "FAILED",
        data: {
            ...agent.data,
            error: "Error message here",
            failedAt: new Date(),
        },
    },
});
```

2. **Record Event:**

```typescript
await recordEvent({
    type: "agent.failed",
    data: {
        agentId,
        role: agent.role,
        codebaseId: agent.codebaseId,
        error: "Error details",
    },
});
```

3. **Notify Workflow:**

```javascript
// n8n workflow
Agent Status Switch
  ↓
FAILED output
  ↓
Stop and Error node
  ↓
Send notification (optional)
```

4. **Preserve Evidence:**

- Keep log file for debugging
- Keep tmux session if possible
- Preserve git working directory

**Recovery:**

Manual intervention required:

```bash
# 1. Inspect logs
docker exec devslave-app-1 cat /tmp/agent_<id>.log

# 2. Attach to tmux (if still alive)
docker exec -it devslave-app-1 tmux attach -t agent_<session>

# 3. Check git status
docker exec devslave-app-1 bash -c "cd /app/dev/projects/myproject && git status"

# 4. Reset and retry
# - Fix underlying issue
# - Reset ticket status
# - Trigger workflow again
```

## Agent Interaction Patterns

### Read-Only Access

**Use Case:** Monitoring agent progress

```typescript
// CLI or external tool
const status = await fetch(`http://localhost:3000/api/agent/status/${agentId}`);
const data = await status.json();

console.log(`Status: ${data.status}`);
console.log(`Progress: ${data.progress}`);
```

### Direct Intervention

**Use Case:** Debug stuck agent

```bash
# Attach to tmux session
docker exec -it devslave-app-1 tmux attach -t agent_1699999999_dev

# Detach without killing: Ctrl+B, then D

# Send commands to session
docker exec devslave-app-1 tmux send-keys -t agent_1699999999_dev "ls -la" C-m

# Kill session
docker exec devslave-app-1 tmux kill-session -t agent_1699999999_dev
```

### Log Streaming

**Use Case:** Real-time monitoring

```bash
# Tail log file
docker exec -it devslave-app-1 tail -f /tmp/agent_ < id > .log

# Parse JSONL and format
docker exec devslave-app-1 tail -f /tmp/agent_ < id > .log \
    | jq -r 'select(.type == "thinking") | .content'
```

### Force Termination

**Use Case:** Agent stuck or infinite loop

```typescript
// API endpoint
POST / api / agent / kill / { agentId };

// Handler
export const killAgentHandler = async (agentId: string) => {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });

    if (!agent?.tmuxSession) {
        throw new Error("Agent session not found");
    }

    // Kill tmux session
    await execAsync(`tmux kill-session -t ${agent.tmuxSession}`);

    // Update status
    await prisma.agent.update({
        where: { id: agentId },
        data: {
            status: "FAILED",
            data: {
                ...agent.data,
                killed: true,
                killedAt: new Date(),
            },
        },
    });

    return { success: true };
};
```

## Data Flow

### Agent Start Flow

```
n8n Workflow
  ↓
HTTP POST /api/agent/start
  ↓
startAgentHandler()
  ├─► Create Agent record (PREPARING)
  ├─► Generate session name
  └─► Call launch-agent.sh
        ↓
      tmux new-session
        ↓
      pipe-pane > log file
        ↓
      codex CLI starts
        ↓
      Update Agent record (LAUNCHED)
        ↓
      Return { agentId, tmuxSession, logFile }
          ↓
        n8n stores response
          ↓
        n8n enters polling loop
```

### Status Polling Flow

```
n8n Workflow (every 30s)
  ↓
HTTP GET /api/agent/status/{agentId}
  ↓
getAgentStatusHandler()
  ├─► Read Agent record
  ├─► Check tmux session alive
  └─► Call watchAgentHandler()
        ├─► Read log file
        ├─► Parse JSONL events
        ├─► Detect completion/error
        └─► Return { status, progress, events }
            ↓
          Update Agent record if status changed
            ↓
          Return status to n8n
              ↓
            n8n evaluates status
              ├─► RUNNING: Wait 30s, poll again
              └─► COMPLETED/FAILED: Exit loop
```

## Concurrent Agents

Multiple agents can run simultaneously:

```
Project A:
  - Dev Agent (RUNNING)

Project B:
  - Architect Agent (RUNNING)
  - QA Agent (RUNNING)

Project C:
  - PM Agent (PREPARING)
```

**Isolation:**

- Each agent in separate tmux session
- Each agent has unique log file
- Each agent works in own git branch
- Database tracks each agent independently

**Resource Contention:**

- Shared CPU/memory in container
- Shared database connections
- Shared filesystem (different directories)

**Limits:**

- Container resources (CPU/RAM)
- Database connection pool (default: 10)
- n8n worker count (default: 1-3)

## Observability

### Database Queries

```typescript
// Get all running agents
const runningAgents = await prisma.agent.findMany({
    where: { status: "RUNNING" },
    include: { codebase: true },
});

// Get agent history for a codebase
const agentHistory = await prisma.agent.findMany({
    where: { codebaseId: "clx123..." },
    orderBy: { createdAt: "desc" },
});

// Get failed agents
const failedAgents = await prisma.agent.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: 10,
});
```

### Event Stream

```typescript
// Get events for an agent
const events = await prisma.events.findMany({
    where: {
        type: { startsWith: "agent." },
        data: {
            path: ["agentId"],
            equals: "clx123...",
        },
    },
    orderBy: { timestamp: "asc" },
});
```

### Metrics

**Track Agent Performance:**

```typescript
// Average completion time by role
const stats = await prisma.$queryRaw`
  SELECT 
    role,
    COUNT(*) as total,
    AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_seconds
  FROM agents
  WHERE status = 'COMPLETED'
  GROUP BY role
`;

// Success rate
const successRate = await prisma.$queryRaw`
  SELECT 
    role,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
    COUNT(*) as total
  FROM agents
  GROUP BY role
`;
```

## Best Practices

### Agent Design

1. **Clear prompts** - Provide specific instructions and context
2. **Bounded tasks** - Break large work into smaller tickets
3. **Observable outputs** - Require agents to log progress
4. **Graceful failure** - Handle errors and provide diagnostics

### Monitoring

1. **Regular polling** - Check status frequently (30s intervals)
2. **Timeout protection** - Kill agents that run too long
3. **Log retention** - Keep logs for debugging
4. **Event recording** - Track all agent activities

### Resource Management

1. **Limit concurrent agents** - Prevent resource exhaustion
2. **Clean up sessions** - Kill tmux sessions when done
3. **Rotate logs** - Archive old log files
4. **Database maintenance** - Archive completed agents

## Troubleshooting

### Agent Won't Start

```bash
# Check container logs
docker-compose logs app

# Verify Codex installed
docker exec devslave-app-1 which codex

# Test Codex directly
docker exec -it devslave-app-1 codex --version

# Check database connectivity
docker exec devslave-app-1 npx prisma db pull
```

### Agent Stuck

```bash
# Attach to session
docker exec -it devslave-app-1 tmux attach -t <session>

# Check what it's doing
docker exec devslave-app-1 tmux capture-pane -t <session> -p

# Check CPU usage
docker exec devslave-app-1 top
```

### Log File Empty

```bash
# Check file exists
docker exec devslave-app-1 ls -la /tmp/agent_*.log

# Check tmux pipe-pane
docker exec devslave-app-1 tmux list-panes -t '#{pane_pipe}' < session > -F

# Manually enable logging
docker exec devslave-app-1 tmux pipe-pane -t "cat >> /tmp/test.log" < session > -o
```

## Further Reading

- [Architecture Deep Dive](architecture.md)
- [Workflow System](workflows.md)
- [Development Guide](development.md)
