FROM debian:bookworm-slim

# Install Node.js 18 and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Install PHP & Composer
RUN /bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.4)"

# Install Laravel CLI
RUN composer global require laravel/installer

# Install Codex
RUN npm install -g @openai/codex

# Copy source code (this will be overridden by volume mount in development)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port (if your app uses one)
EXPOSE 3000

# Command to run the application in development mode with live reload
CMD ["npm", "run", "server"]
