FROM debian:bookworm-slim

# Install Node.js 18 and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install favorite apt packages
RUN apt-get update && apt-get install -y git zip unzip nano tree rsync sqlite3 tmux htop openssh-server

# Configure SSH for simple access
RUN mkdir /var/run/sshd \
    && echo 'root:dev' | chpasswd \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd \
    && echo 'ListenAddress 0.0.0.0' >> /etc/ssh/sshd_config \
    && echo 'Port 2222' >> /etc/ssh/sshd_config

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"
RUN uv venv /.venv
ENV PATH="/.venv/bin:${PATH}"

# Install PHP & Composer (herd-lite)
ENV TERM=xterm
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
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

############################################################
# Layout:
#   /app/agent  -> this project's source (bind-mounted)
#   /app/dev    -> writable workspace (named volume)
############################################################

# Prepare directory structure before copying
RUN mkdir -p /app/agent /app/dev \
    && chmod 775 /app/dev

WORKDIR /app/agent

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Copy source code (overridden by bind mount during development)
COPY . /app/agent

# Install Codex
RUN npm install -g @openai/codex

# Copy source code (this will be overridden by volume mount in development)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose ports
EXPOSE 3000 2222

# Command to run the application in development mode with live reload
CMD service ssh start && npm run server
