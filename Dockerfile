FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y curl ca-certificates gnupg \
    git zip unzip nano tree rsync sqlite3 tmux htop openssh-server lsof jq \
    && apt-get update \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH for simple access and environment variable support
RUN mkdir /var/run/sshd \
    && echo 'root:dev' | chpasswd \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd \
    && echo 'ListenAddress 0.0.0.0' >> /etc/ssh/sshd_config \
    && echo 'Port 2222' >> /etc/ssh/sshd_config \
    && echo 'PermitUserEnvironment yes' >> /etc/ssh/sshd_config

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
RUN bash -lc 'export NVM_DIR="/root/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm install 22; nvm alias default 22; nvm use 22; node_path="$(nvm which node)"; bin_dir="$(dirname "$node_path")"; ln -sf "$node_path" /usr/local/bin/node; for b in npm npx corepack; do if [ -f "$bin_dir/$b" ]; then ln -sf "$bin_dir/$b" /usr/local/bin/$b; fi; done'

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"
RUN uv venv /.venv
ENV PATH="/.venv/bin:${PATH}"

# Install PHP & Composer (herd-lite)
ENV TERM=xterm
RUN apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://php.new/install/linux/8.4 -o /tmp/install_php.sh \
    && sed -i 's/^clear/# clear/' /tmp/install_php.sh \
    && bash /tmp/install_php.sh
ENV PATH="/root/.config/herd-lite/bin:${PATH}"

# Install Laravel CLI
RUN composer global require laravel/installer

# Install Ollama (optional, pass --build-arg INSTALL_OLLAMA=true to install)
ARG INSTALL_OLLAMA=false
RUN if [ "$INSTALL_OLLAMA" = "true" ]; then curl -fsSL https://ollama.com/install.sh | sh; fi
# Install duckduckgo-mcp-server in uv venv
RUN if [ "$INSTALL_OLLAMA" = "true" ]; then uv pip install duckduckgo-mcp-server; fi

# Install Go 
RUN curl -sSfL https://golang.org/dl/go1.21.5.linux-amd64.tar.gz -o /tmp/go.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf /tmp/go.tar.gz && \
    rm /tmp/go.tar.gz
ENV PATH=$PATH:/usr/local/go/bin

# Install Gitleaks from source
RUN git clone https://github.com/gitleaks/gitleaks.git /tmp/gitleaks && \
    cd /tmp/gitleaks && \
    go build -o /usr/local/bin/gitleaks && \
    rm -rf /tmp/gitleaks


# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install pre-commit
RUN uv pip install pre-commit

# Install Prisma CLI
RUN npm install -g prisma

############################################################
# Layout:
#   /app/agent  -> this project's source (bind-mounted)
#   /app/dev    -> writable workspace (named volume)
############################################################

# Prepare directory structure before copying
RUN mkdir -p /app/agent /app/dev \
    && chmod 775 /app/dev

# Copy environment setup script (will be executed at runtime)
COPY docker/app/setup-env.sh /usr/local/bin/setup-env.sh
RUN chmod +x /usr/local/bin/setup-env.sh

WORKDIR /app/agent

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (overridden by bind mount during development)
COPY . /app/agent

# Install Codex
RUN npm install -g @openai/codex

# Copy source code (this will be overridden by volume mount in development)
COPY . .

# Generate Prisma client at runtime (avoid build-time generate to prevent staleness with bind mounts)

# Expose ports
EXPOSE 3000 2222

# Entrypoint script runs migrations, generates Prisma client, and starts server
COPY docker/app/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Command to run the application in development mode with live reload
CMD ["/usr/local/bin/entrypoint.sh"]
