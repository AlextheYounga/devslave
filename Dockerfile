FROM debian:bookworm-slim

# Install Node.js 18 and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    && apt-get update \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install favorite apt packages
RUN apt-get update && apt-get install -y git zip unzip nano tree rsync sqlite3 tmux htop openssh-server

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
RUN bash -lc 'export NVM_DIR="/root/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm install 22; nvm alias default 22; nvm use 22; node_path="$(nvm which node)"; bin_dir="$(dirname "$node_path")"; ln -sf "$node_path" /usr/local/bin/node; for b in npm npx corepack; do if [ -f "$bin_dir/$b" ]; then ln -sf "$bin_dir/$b" /usr/local/bin/$b; fi; done'

# Install uv and create virtual environment
ENV UV_HOME=/root/.local/bin
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && ln -sf $UV_HOME/uv /usr/local/bin/uv \
    && uv --version \
    && uv venv /.venv
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

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Install Codex
RUN npm install -g @openai/codex

# Install duckduckgo-mcp-server in uv venv
RUN uv pip install duckduckgo-mcp-server

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

# Install dependencies (cached layer prior to dev bind mount)
RUN npm install

# Generate Prisma client (schema resides inside /app/agent/prisma)
RUN npx prisma generate

# Expose port (if your app uses one)
EXPOSE 3000 2222

# App entrypoint: start sshd then app cmd
COPY docker/app/entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["npm", "run", "server"]
