FROM docker.n8n.io/n8nio/n8n:latest

# Add OpenSSH client so n8n can run `ssh` in Execute Command nodes
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-client \
    && rm -rf /var/lib/apt/lists/*
USER node

