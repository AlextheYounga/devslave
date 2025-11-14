# Docker Setup

This document explains the Docker architecture, configuration, and operational details of the DevSlave system.

## Overview

DevSlave uses Docker Compose to orchestrate multiple services that work together to provide the agent execution environment. Each service has a specific role in the system.

## Services

### 1. PostgreSQL (`postgres`)

**Purpose:** Primary database for application state

**Image:** `postgres:16`

**Configuration:**

```yaml
services:
    postgres:
        image: postgres:16
        restart: unless-stopped
        environment:
            - POSTGRES_USER=n8n
            - POSTGRES_PASSWORD=n8n
            - POSTGRES_DB=n8n
            - POSTGRES_NON_ROOT_USER=n8n
            - POSTGRES_NON_ROOT_PASSWORD=n8n
            - APP_POSTGRES_DB=devslave_app
            - TEST_POSTGRES_DB=devslave_test
        volumes:
            - db_storage:/var/lib/postgresql/data
            - ./docker/pg/init-data.sh:/docker-entrypoint-initdb.d/init-data.sh
        ports:
            - "127.0.0.1:5432:5432"
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -h localhost -U n8n -d n8n"]
            interval: 5s
            timeout: 5s
            retries: 10
```

**Databases Created:**

1. **n8n** - n8n workflow data (executions, credentials, settings)
2. **devslave_app** - Application data (agents, codebases, tickets, events)
3. **devslave_test** - Test database (isolated from app data)

**Initialization Script:**

```bash
# docker/pg/init-data.sh
#!/bin/bash
set -e

# Create app database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<- EOSQL
    CREATE DATABASE "$APP_POSTGRES_DB";
    GRANT ALL PRIVILEGES ON DATABASE "$APP_POSTGRES_DB" TO "$POSTGRES_NON_ROOT_USER";
EOSQL

# Create test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<- EOSQL
    CREATE DATABASE "$TEST_POSTGRES_DB";
    GRANT ALL PRIVILEGES ON DATABASE "$TEST_POSTGRES_DB" TO "$POSTGRES_NON_ROOT_USER";
EOSQL
```

**Port Binding:**

- `127.0.0.1:5432:5432` - Localhost only (security)
- Accessible from host for Prisma Studio, psql, etc.

**Volume:**

- `db_storage` - Named volume for data persistence

### 2. Redis (`redis`)

**Purpose:** Message queue backend for n8n worker coordination

**Image:** `redis:6-alpine`

**Configuration:**

```yaml
services:
    redis:
        image: redis:6-alpine
        restart: unless-stopped
        volumes:
            - redis_storage:/data
        healthcheck:
            test: ["CMD", "redis-cli", "ping"]
            interval: 5s
            timeout: 5s
            retries: 10
```

**Why Redis:**

- Required by n8n for queue-based execution
- Enables multiple n8n workers
- In-memory performance
- Simple, reliable

**Volume:**

- `redis_storage` - Persistence for queue state

### 3. n8n (`n8n` and `n8n-worker`)

**Purpose:** Workflow orchestration and agent coordination

**Image:** `docker.n8n.io/n8nio/n8n`

**Main Instance Configuration:**

```yaml
services:
    n8n:
        image: docker.n8n.io/n8nio/n8n
        restart: unless-stopped
        environment:
            - DB_TYPE=postgresdb
            - DB_POSTGRESDB_HOST=postgres
            - DB_POSTGRESDB_PORT=5432
            - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
            - DB_POSTGRESDB_USER=${POSTGRES_NON_ROOT_USER}
            - DB_POSTGRESDB_PASSWORD=${POSTGRES_NON_ROOT_PASSWORD}
            - EXECUTIONS_MODE=queue
            - QUEUE_BULL_REDIS_HOST=redis
            - QUEUE_HEALTH_CHECK_ACTIVE=true
            - N8N_ENCRYPTION_KEY=${ENCRYPTION_KEY}
        ports:
            - 127.0.0.1:5678:5678
        volumes:
            - n8n_storage:/home/node/.n8n
        depends_on:
            redis:
                condition: service_healthy
            postgres:
                condition: service_healthy
```

**Worker Configuration:**

```yaml
services:
    n8n-worker:
        # Same as n8n, but:
        command: worker
        # No ports exposed
```

**Execution Modes:**

- **Regular mode:** Single n8n instance executes workflows
- **Queue mode:** Workflows queued in Redis, workers pick up jobs
- **Benefits:** Better concurrency, resilience, scalability

**Port Binding:**

- `127.0.0.1:5678:5678` - Web UI and webhook endpoints

**Volume:**

- `n8n_storage` - Workflow definitions, credentials, settings

**YAML Anchor (`x-shared`):**

```yaml
x-shared: &shared
    restart: unless-stopped
    image: docker.n8n.io/n8nio/n8n
    environment:
        # ... shared environment variables
    volumes:
        - n8n_storage:/home/node/.n8n
    depends_on:
        # ... dependencies
```

This allows DRY configuration between n8n and n8n-worker.

### 4. Ollama (`ollama`)

**Purpose:** Local LLM inference (optional Codex backend)

**Image:** `ollama/ollama:latest`

**Configuration:**

```yaml
services:
    ollama:
        image: ollama/ollama:latest
        restart: unless-stopped
        volumes:
            - ${HOME}/.ollama:/root/.ollama
        ports:
            - "127.0.0.1:11434:11434"
        healthcheck:
            test: ["CMD", "ollama", "list"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 10s
```

**Why Ollama:**

- Cost savings vs OpenAI API
- Privacy (on-premises inference)
- Fast local inference
- Compatible with OpenAI API format

**Volume:**

- `${HOME}/.ollama` - Shares models with host (read/write)
- No need to re-download models in container

**Models:**

```bash
# On host, download models
ollama pull llama3.1:8b
ollama pull codellama:13b

# Models automatically available in container
docker-compose exec ollama ollama list
```

**API Endpoint:**

- `http://ollama:11434` - OpenAI-compatible API
- Configured in Codex via `CODEX_OSS_BASE_URL`

### 5. App (`app`)

**Purpose:** Agent execution environment and API server

**Custom Build:** `Dockerfile`

**Configuration:**

```yaml
services:
    app:
        build:
            context: .
            args:
                - AGENT_REPO=${AGENT_REPO}
                - DEV_WORKSPACE=${DEV_WORKSPACE}
        restart: unless-stopped
        volumes:
            - .:/app/agent # Project source (bind mount)
            - app_node_modules:/app/agent/node_modules # Dependencies (named volume)
            - dev_data:/app/dev # Agent workspace (persistent)
            - codex_data:/root/.codex # Codex config (isolated)
            - ${HOME}/.codex:/seed/.codex:ro # Seed Codex config (read-only)
        working_dir: /app/agent
        environment:
            - NODE_ENV=development
            - MACHINE_CONTEXT=docker
            - DATABASE_URL=postgresql://...
            - CODEX_OSS_BASE_URL=http://ollama:11434
            - OLLAMA_HOST=http://ollama:11434
            # ... more environment variables
        depends_on:
            postgres:
                condition: service_healthy
            redis:
                condition: service_healthy
            ollama:
                condition: service_healthy
        ports:
            - "127.0.0.1:3000:3000" # API server
            - "127.0.0.1:2222:2222" # SSH server
```

**Volume Strategy:**

1. **Bind Mount (`.:/app/agent`)**
    - **Purpose:** Live editing from host
    - **Contains:** Source code
    - **Why:** Instant changes without rebuild

2. **Named Volume (`app_node_modules`)**
    - **Purpose:** Fast dependency access
    - **Contains:** node_modules/
    - **Why:** Bind mounts are slow for node_modules

3. **Named Volume (`dev_data`)**
    - **Purpose:** Agent workspace persistence
    - **Contains:** Cloned projects, agent outputs, temp files
    - **Why:** Survives container restarts

4. **Named Volume (`codex_data`)**
    - **Purpose:** Isolated Codex configuration
    - **Contains:** Codex credentials, session history
    - **Why:** Keep container config separate from host

5. **Bind Mount (`${HOME}/.codex:/seed/.codex:ro`)**
    - **Purpose:** Seed Codex config from host
    - **Read-only:** Container doesn't modify host config
    - **Why:** Copy credentials on first run

**Port Bindings:**

- `3000` - Express API server
- `2222` - SSH server (for n8n SSH nodes)

**Environment Variables:**

See `.env.example` for full list. Key variables:

```bash
# Database
DATABASE_URL="postgresql://n8n:n8n@postgres:5432/devslave_app"

# Paths
AGENT_REPO=/app/agent
DEV_WORKSPACE=/app/dev
PROJECT_OUTPUT_DIR=/app/dev/projects

# Git
GIT_USERNAME="Agent Bot"
GIT_EMAIL=agent@example.com
GIT_DEFAULT_BRANCH=master

# Codex
CODEX_OSS_BASE_URL=http://ollama:11434

# API
APP_BASE_URL=http://app:3000
N8N_BASE_URL=http://n8n:5678
```

## Dockerfile Breakdown

### Base Image

```dockerfile
FROM debian:bookworm-slim
```

**Why Debian:**

- Stable, well-supported
- Small base image
- APT package manager
- Compatible with most tools

### System Packages

```dockerfile
RUN apt-get update && apt-get install -y \
 curl ca-certificates gnupg \
 git zip unzip nano tree rsync \
 sqlite3 postgresql-client \
 tmux htop openssh-server lsof jq \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
```

**Categories:**

- **Core:** curl, ca-certificates, gnupg
- **Development:** git, nano, tree
- **Databases:** sqlite3, postgresql-client
- **Utilities:** tmux, htop, lsof, jq
- **SSH:** openssh-server (for n8n SSH nodes)

### SSH Configuration

```dockerfile
RUN mkdir /var/run/sshd \
 && echo 'root:dev' | chpasswd \
 && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
 && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
 && echo 'PermitUserEnvironment yes' >>/etc/ssh/sshd_config \
 && echo 'Port 2222' >>/etc/ssh/sshd_config
```

**Purpose:** Allow n8n SSH nodes to execute commands in container

**Security:**

- Only accessible from Docker network
- Simple password (not exposed to internet)
- Port 2222 (not standard SSH port)

### Language Runtimes

**Node.js (via nvm):**

```dockerfile
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
RUN bash -lc 'nvm install 22; nvm alias default 22; nvm use 22'
```

**Python (via uv):**

```dockerfile
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN uv venv /.venv
ENV PATH="/.venv/bin:${PATH}"
```

**PHP (via herd-lite):**

```dockerfile
RUN curl -fsSL https://php.new/install/linux/8.4 | bash
ENV PATH="/root/.config/herd-lite/bin:${PATH}"
RUN composer global require laravel/installer
```

**Go:**

```dockerfile
RUN curl -sSfL https://golang.org/dl/go1.21.5.linux-amd64.tar.gz -o /tmp/go.tar.gz
RUN tar -C /usr/local -xzf /tmp/go.tar.gz
ENV PATH=$PATH:/usr/local/go/bin
```

**Rust:**

```dockerfile
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
```

**Why Multiple Languages:**

- Agents can work on any type of project
- No need for language-specific containers
- All tools available in one environment

### Security Tools

**Gitleaks (secret scanning):**

```dockerfile
RUN git clone https://github.com/gitleaks/gitleaks.git /tmp/gitleaks
RUN cd /tmp/gitleaks && go build -o /usr/local/bin/gitleaks
```

**pre-commit (Git hooks):**

```dockerfile
RUN uv pip install pre-commit
```

### Application Setup

```dockerfile
WORKDIR /app/agent

COPY package*.json ./
RUN npm install

COPY . .

RUN npm install -g @openai/codex prisma

EXPOSE 3000 2222

COPY docker/app/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]
```

**Entrypoint Script:**

```bash
#!/usr/bin/env bash
set -euo pipefail

source ~/.nvm/nvm.sh
source /usr/local/bin/setup-env.sh

setup_environment_variables

# Start SSH server
service ssh start

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Start API server
exec npm run server
```

**Why exec:**

- Replaces shell process with Node process
- Ensures proper signal handling (SIGTERM, SIGINT)
- Allows graceful shutdown

## Volume Management

### Named Volumes

```yaml
volumes:
    db_storage: # PostgreSQL data
    n8n_storage: # n8n data
    redis_storage: # Redis persistence
    app_node_modules: # Node.js dependencies
    dev_data: # Agent workspace
    codex_data: # Codex configuration
```

**Inspect volumes:**

```bash
docker volume ls
docker volume inspect devslave_dev_data
```

**Backup volumes:**

```bash
# Backup agent workspace
docker run --rm \
    -v devslave_dev_data:/data \
    -v $(pwd):/backup \
    alpine tar czf /backup/dev_data_backup.tar.gz -C /data .

# Restore
docker run --rm \
    -v devslave_dev_data:/data \
    -v $(pwd):/backup \
    alpine tar xzf /backup/dev_data_backup.tar.gz -C /data
```

**Clean volumes (⚠️ destroys data):**

```bash
docker-compose down -v
```

### Bind Mounts

**Project Source (`.:/app/agent`):**

- Live editing
- Git changes reflected immediately
- IDE integration

**Ollama Models (`${HOME}/.ollama:/root/.ollama`):**

- Share models between host and container
- No redundant downloads
- Manage models from host

**Codex Seed (`${HOME}/.codex:/seed/.codex:ro`):**

- Read-only access to host config
- Container copies credentials on first run
- Host config remains unmodified

## Networking

### Default Bridge Network

All services communicate via Docker's default bridge network:

```
postgres:5432
redis:6379
n8n:5678
ollama:11434
app:3000
```

**Service Discovery:**

- Services refer to each other by service name
- Example: `http://app:3000/api/health`

**No Custom Network Needed:**

- All services in same compose file
- Automatic DNS resolution
- Isolated from external networks

### Port Forwarding

**Bound to Localhost Only:**

```yaml
ports:
    - "127.0.0.1:3000:3000" # Only accessible from host
```

**Why Localhost Binding:**

- Security (not exposed to LAN/internet)
- Prevents accidental exposure
- Explicit port forwarding required for remote access

**Access from LAN:**

If needed, use SSH tunneling or reverse proxy:

```bash
# SSH tunnel
ssh -L 3000:localhost:3000 user@host

# Or update docker-compose.yml
ports:
- "0.0.0.0:3000:3000" # ⚠️ Exposed to network
```

## Environment Variables

### .env File

```bash
# Located at project root
.env

# Loaded by docker-compose automatically
# Also loaded by app via dotenv
```

**Structure:**

```bash
# App Configuration
NODE_ENV=development
MACHINE_CONTEXT=docker

# Database
APP_POSTGRES_DB=devslave_app
TEST_POSTGRES_DB=devslave_test
DATABASE_URL="postgresql://n8n:n8n@postgres:5432/devslave_app"

# Docker Paths
AGENT_REPO=/app/agent
DEV_WORKSPACE=/app/dev
PROJECT_OUTPUT_DIR=/app/dev/projects

# Git
GIT_USERNAME="Agent Bot"
GIT_EMAIL=agent@example.com
GIT_DEFAULT_BRANCH=master

# n8n
N8N_API_KEY=your_api_key
N8N_MASTER_WEBHOOK_URL=http://n8n:5678/webhook/master
N8N_BASE_URL=http://n8n:5678

# Codex
CODEX_OSS_BASE_URL=http://ollama:11434

# Docker Compose
POSTGRES_USER=n8n
POSTGRES_PASSWORD=n8n
POSTGRES_DB=n8n
POSTGRES_NON_ROOT_USER=n8n
POSTGRES_NON_ROOT_PASSWORD=n8n
ENCRYPTION_KEY=test123
```

### Runtime Environment Setup

**setup-env.sh:**

```bash
#!/usr/bin/env bash

setup_environment_variables() {
    # Export all environment variables for SSH sessions
    env | grep -E '^(NODE_ENV|DATABASE_URL|AGENT_REPO|DEV_WORKSPACE|GIT_|CODEX_)' \
        > /root/.ssh/environment

    # Source in shell profiles
    echo "export $(cat /root/.ssh/environment | xargs)" >> /root/.bashrc
}
```

**Why This Matters:**

- SSH sessions don't inherit Docker environment
- n8n SSH nodes need environment variables
- Ensures consistency across all shell sessions

## Common Operations

### Starting Services

```bash
# Start all
docker-compose up -d

# Start specific service
docker-compose up -d app

# View logs
docker-compose logs -f app

# Follow all logs
docker-compose logs -f
```

### Stopping Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (⚠️ destroys data)
docker-compose down -v

# Stop specific service
docker-compose stop app
```

### Rebuilding

```bash
# Rebuild app container
docker-compose build app

# Rebuild without cache
docker-compose build --no-cache app

# Rebuild and restart
docker-compose up -d --build app
```

### Accessing Containers

```bash
# Shell access
docker-compose exec app bash

# Run one-off command
docker-compose exec app npm test

# Access as different user
docker-compose exec -u node app bash
```

### Viewing Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs app

# Follow logs
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app

# Timestamps
docker-compose logs -f --timestamps app
```

### Health Checks

```bash
# Check service health
docker-compose ps

# Detailed inspect
docker inspect devslave-postgres-1 | jq '.[0].State.Health'

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:5678/healthz
curl http://localhost:11434/api/tags
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Check for port conflicts
lsof -i :3000

# Inspect container
docker inspect devslave-app-1

# Check dependencies
docker-compose ps
```

### Volume Permission Issues

```bash
# Check volume ownership
docker-compose exec app ls -la /app/dev

# Fix ownership
docker-compose exec app chown -R root:root /app/dev
```

### Database Connection Errors

```bash
# Test from app container
docker-compose exec app psql $DATABASE_URL -c "SELECT 1"

# Check postgres logs
docker-compose logs postgres

# Verify healthcheck
docker-compose ps postgres
```

### Network Issues

```bash
# Check network
docker network ls
docker network inspect devslave_default

# Test connectivity
docker-compose exec app ping postgres
docker-compose exec app curl http://n8n:5678/healthz
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a
docker volume prune

# Remove unused images
docker image prune -a
```

## Production Considerations

### Security Hardening

1. **Use secrets management:**

    ```yaml
    secrets:
        db_password:
            file: ./secrets/db_password.txt
    ```

2. **Non-root user:**

    ```dockerfile
    RUN useradd -m agent
    USER agent
    ```

3. **Read-only root filesystem:**

    ```yaml
    services:
        app:
            read_only: true
            tmpfs:
                - /tmp
    ```

4. **Resource limits:**
    ```yaml
    services:
        app:
            deploy:
                resources:
                    limits:
                        cpus: "2"
                        memory: 4G
    ```

### Monitoring

```yaml
services:
    prometheus:
        image: prom/prometheus
        volumes:
            - ./prometheus.yml:/etc/prometheus/prometheus.yml
        ports:
            - "9090:9090"

    grafana:
        image: grafana/grafana
        ports:
            - "3001:3000"
```

### Backup Strategy

1. **Database backups:**

    ```bash
    docker-compose exec postgres pg_dump -U n8n devslave_app > backup.sql
    ```

2. **Volume backups:**

    ```bash
    docker run --rm -v devslave_dev_data:/data -v $(pwd):/backup \
        alpine tar czf /backup/dev_data.tar.gz -C /data .
    ```

3. **Configuration backups:**
    ```bash
    tar czf config_backup.tar.gz .env docker-compose.yml
    ```

## Further Reading

- [Architecture Deep Dive](architecture.md)
- [Development Guide](development.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
