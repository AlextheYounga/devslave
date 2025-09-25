#!/bin/bash

# Ensure .ssh directory exists
mkdir -p ~/.ssh

# Generate SSH key pair if it doesn't exist
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "Generating SSH key pair..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" -C "docker-container"
    echo "SSH key pair generated."
else
    echo "SSH key pair already exists."
fi

# Execute the main command
exec "$@"
