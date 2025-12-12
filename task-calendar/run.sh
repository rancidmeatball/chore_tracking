#!/bin/sh
# Minimal script - just set env vars and exec node
# This ensures we run as PID 1 (required by s6-overlay)

export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN:-}"
export DATABASE_PATH="/data/task-calendar.db"
export DATABASE_URL="file:${DATABASE_PATH}"

# Create data directory
mkdir -p /data

# Use Node.js start script which handles everything
exec /usr/bin/node /app/start.js
