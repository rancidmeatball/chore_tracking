#!/usr/bin/with-contenv bashio

# Get Home Assistant token from supervisor
export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN}"

# Get database path from options
DATABASE_PATH=$(bashio::config 'database_path')
export DATABASE_URL="file:${DATABASE_PATH}"

# Initialize database if needed
if [ ! -f "${DATABASE_PATH}" ]; then
    npx prisma db push
fi

# Start the application
exec npm start
