# Quick Reference

Common commands and operations for working with DevSlave.

## Starting/Stopping

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a service
docker-compose restart app

# View service status
docker-compose ps
```

## CLI Commands

```bash
# Interactive menu
devs

# Or run directly
npm run dev

# Main menu options
devs # → Create Project
devs # → View Running Agents (attach to tmux, view logs, kill)
devs # → Start Workflow
devs # → Utilities
#    - Open Shell in App Container
#    - Open Agent Container in VSCode
#    - Start Docker
#    - Open n8n
#    - Clone Project
```

## API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# List codebases
curl http://localhost:3000/api/codebases

# Get codebase details
curl http://localhost:3000/api/codebases/{id}

# Start agent
curl -X POST http://localhost:3000/api/agent/start \
    -H "Content-Type: application/json" \
    -d '{"codebaseId": "...", "role": "dev"}'

# Get agent status
curl http://localhost:3000/api/agent/status/{agentId}

# Kill agent
curl -X POST http://localhost:3000/api/agent/kill/{agentId}
```

## Database

```bash
# Run migrations
docker-compose exec app npm run db:migrate

# Reset database (⚠️ destroys data)
docker-compose exec app npm run db:reset:test

# Open Prisma Studio
docker-compose exec app npx prisma studio
# Access at http://localhost:5555

# Direct psql access
docker-compose exec postgres psql -U n8n devslave_app

# Common queries
docker-compose exec postgres psql -U n8n devslave_app -c "SELECT * FROM agents WHERE status = 'RUNNING'"
```

## Agent Management

```bash
# List tmux sessions
docker-compose exec app tmux ls

# Attach to agent session
docker-compose exec -it app tmux attach -t agent_<session>
# Detach: Ctrl+B, then D

# View agent log
docker-compose exec app cat /tmp/agent_<id>.log

# Tail agent log
docker-compose exec -it app tail -f /tmp/agent_<id>.log

# Kill stuck agent
docker-compose exec app tmux kill-session -t agent_<session>
```

## n8n Workflows

```bash
# Access n8n UI
open http://localhost:5678

# Trigger master workflow
curl -X POST http://localhost:5678/webhook/master \
    -H "Content-Type: application/json" \
    -d '{"codebaseId": "...", "trigger": "user"}'

# View executions
# Navigate to n8n UI → Executions tab
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- myfile.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run tests in Docker
docker-compose exec app npm test
```

## Logs

```bash
# View all service logs
docker-compose logs

# Follow specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app

# Timestamps
docker-compose logs -f --timestamps app

# Multiple services
docker-compose logs -f app postgres
```

## Docker Maintenance

```bash
# Rebuild container
docker-compose build app

# Rebuild without cache
docker-compose build --no-cache app

# Rebuild and restart
docker-compose up -d --build app

# Remove all containers and volumes
docker-compose down -v

# Clean up Docker system
docker system prune -a
docker volume prune
```

## Git Operations

```bash
# Inside app container
docker-compose exec app bash

# Navigate to project
cd /app/dev/projects/myproject

# Standard git operations
git status
git log
git diff
git checkout -b feature/new-feature
```

## Environment

```bash
# View environment variables
docker-compose exec app env | grep -E '(DATABASE_URL|CODEX|AGENT)'

# Edit .env file
nano .env

# Reload environment (restart services)
docker-compose down
docker-compose up -d
```

## Container Access

```bash
# Via CLI (easiest)
devs
# Select: Utilities → Open Shell in App Container

# Or use helper script
./docker/dev-container.sh

# Direct docker command
docker-compose exec app bash

# VS Code Remote (via CLI)
devs
# Select: Utilities → Open Agent Container on VSCode

# Or use helper script
./docker/vscode-remote.sh
```

## Debugging

```bash
# Shell into container
docker-compose exec app bash

# Check running processes
docker-compose exec app ps aux

# Check disk usage
docker-compose exec app df -h

# Check memory usage
docker-compose exec app free -m

# Network connectivity
docker-compose exec app ping postgres
docker-compose exec app curl http://n8n:5678/healthz

# Inspect container
docker inspect devslave-app-1

# Container stats
docker stats devslave-app-1
```

## Backup & Restore

```bash
# Backup database
docker-compose exec postgres pg_dump -U n8n devslave_app > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U n8n devslave_app

# Backup volume
docker run --rm \
    -v devslave_dev_data:/data \
    -v $(pwd):/backup \
    alpine tar czf /backup/dev_data.tar.gz -C /data .

# Restore volume
docker run --rm \
    -v devslave_dev_data:/data \
    -v $(pwd):/backup \
    alpine tar xzf /backup/dev_data.tar.gz -C /data
```

## Ollama

```bash
# List models
docker-compose exec ollama ollama list

# Pull model
docker-compose exec ollama ollama pull llama3.1:8b

# Test inference
docker-compose exec ollama ollama run llama3.1:8b "Hello, world!"

# API request
curl http://localhost:11434/api/tags
```

## File Locations

### In Container

```
/app/agent              # Project source (bind mount)
/app/dev                # Agent workspace
/app/dev/projects       # Cloned projects
/tmp/agent_*.log        # Agent logs
/root/.codex            # Codex configuration
/var/log                # System logs
```

### On Host

```
.                       # Project root
.env                    # Environment configuration
docker-compose.yml      # Service definitions
src/                    # Source code
prisma/                 # Database schema
docker/                 # Docker-related files
docs/                   # Documentation
test/                   # Test files
```

## Common Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run server
```

### Database Connection Failed

```bash
# Check Postgres running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection
docker-compose exec app psql $DATABASE_URL -c "SELECT 1"
```

### Container Won't Start

```bash
# View logs
docker-compose logs app

# Check for errors
docker-compose logs --tail=50 app

# Rebuild
docker-compose down
docker-compose build --no-cache app
docker-compose up -d
```

### Agent Not Starting

```bash
# Check agent record
docker-compose exec app npx prisma studio

# Check tmux sessions
docker-compose exec app tmux ls

# Check Codex installed
docker-compose exec app which codex

# Test Codex
docker-compose exec app codex --version
```

## Keyboard Shortcuts

### tmux

- `Ctrl+B, then D` - Detach from session
- `Ctrl+B, then C` - Create new window
- `Ctrl+B, then N` - Next window
- `Ctrl+B, then [` - Scroll mode (Q to exit)

### CLI

- `Ctrl+C` - Exit current operation
- `↑/↓` - Navigate menu options
- `Enter` - Select option

## Environment Variables

### Required

```bash
DATABASE_URL="postgresql://..."
N8N_API_KEY="..."
PROJECT_OUTPUT_DIR="/path/to/projects"
GIT_USERNAME="..."
GIT_EMAIL="..."
```

### Optional

```bash
CODEX_OSS_BASE_URL="http://ollama:11434"
PORT="3000"
N8N_BASE_URL="http://localhost:5678"
```

## Project Phases

```
DESIGN       → Architect creates specs
PLANNING     → PM generates tickets
DEVELOPMENT  → Dev/QA implement features
COMPLETED    → All tickets closed
```

## Agent Roles

```
architect    → System design and architecture
pm           → Project planning and tickets
dev          → Feature implementation
qa           → Testing and quality review
```

## Ticket Statuses

```
OPEN                      → Ready for development
IN_PROGRESS               → Dev working on it
QA_REVIEW                 → Ready for QA
QA_CHANGES_REQUESTED      → QA found issues
CLOSED                    → Completed and merged
```

## Support

- 📚 Full Documentation: [docs/](docs/)
- 🏗️ Architecture: [docs/architecture.md](docs/architecture.md)
- 🔄 Workflows: [docs/workflows.md](docs/workflows.md)
- 🤖 Agent Lifecycle: [docs/agent-lifecycle.md](docs/agent-lifecycle.md)
- 💻 Development: [docs/development.md](docs/development.md)
- 🐳 Docker Setup: [docs/docker-setup.md](docs/docker-setup.md)
- 📖 Engineering Philosophy: [AGENTS.md](AGENTS.md)
