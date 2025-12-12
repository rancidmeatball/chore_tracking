#!/bin/sh
set -e

# Get Home Assistant token from supervisor
export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN:-}"

# Use default database path (matches config.json default)
DATABASE_PATH="/data/task-calendar.db"
export DATABASE_URL="file:${DATABASE_PATH}"

# Create data directory if needed
mkdir -p "$(dirname "${DATABASE_PATH}")"

# Initialize database if needed (use full path to avoid PATH issues)
if [ ! -f "${DATABASE_PATH}" ]; then
    cd /app
    /usr/bin/npx prisma db push || true
fi

# Change to app directory
cd /app

# For standalone build - use exec to replace shell with node process (required for PID 1)
if [ -d "/app/.next/standalone" ]; then
    cd /app/.next/standalone
    exec /usr/bin/node server.js
else
    # Fallback to regular start
    exec /usr/bin/npm start
fi
