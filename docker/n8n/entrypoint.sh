#!/bin/bash
set -e

# Check if xdg-open is installed; if not, install it using apt-get
if ! command -v xdg-open > /dev/null 2>&1; then
    echo "xdg-open not found. Installing xdg-utils..."
    apt-get update && apt-get install -y xdg-utils
fi

# Execute any arguments passed to the script
exec "$@"
