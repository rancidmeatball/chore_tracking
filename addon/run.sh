#!/bin/sh
set -e

# Get Home Assistant token from supervisor
export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN:-}"

# Use default database path (matches config.json default)
# Home Assistant will mount /data, so use that
DATABASE_PATH="/data/task-calendar.db"
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
