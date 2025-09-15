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

# Create app directory
WORKDIR /app

# Install favorite apt packages
RUN apt-get update && apt-get install -y git zip unzip nano tree rsync sqlite3 tmux htop

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN uv venv /.venv

# Install PHP & Composer (herd-lite)
ENV TERM=xterm
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://php.new/install/linux/8.4 -o /tmp/install_php.sh \
    && sed -i 's/^clear/# clear/' /tmp/install_php.sh \
    && bash /tmp/install_php.sh
ENV PATH="/root/.config/herd-lite/bin:${PATH}"

# Install Laravel CLI
RUN composer global require laravel/installer

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Install Codex
RUN npm install -g @openai/codex

# Install duckduckgo-mcp-server in uv venv
RUN uv pip install duckduckgo-mcp-server

# Copy source code (this will be overridden by volume mount in development)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port (if your app uses one)
EXPOSE 3000 

# Command to run the application in development mode with live reload
CMD ["npm", "run", "server"]
