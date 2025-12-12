#!/bin/sh
set -e

# Load bashio if available (for Home Assistant integration)
if [ -f /usr/bin/bashio ]; then
    . /usr/bin/bashio
fi

# Get Home Assistant token from supervisor
export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN:-}"

# Get database path from Home Assistant config or use default
if command -v bashio >/dev/null 2>&1; then
    DATABASE_PATH=$(bashio config 'database_path' 2>/dev/null || echo "/data/task-calendar.db")
else
    DATABASE_PATH="${DATABASE_PATH:-/data/task-calendar.db}"
fi
export DATABASE_URL="file:${DATABASE_PATH}"

# Create data directory if needed
mkdir -p "$(dirname "${DATABASE_PATH}")"

# Initialize database if needed
if [ ! -f "${DATABASE_PATH}" ]; then
    cd /app
    npx prisma db push
fi

# Change to app directory
cd /app

# For standalone build
if [ -d "/app/.next/standalone" ]; then
    cd /app/.next/standalone
    exec node server.js
else
    # Fallback to regular start
    exec npm start
fi
