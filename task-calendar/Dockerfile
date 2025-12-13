ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy all files from build context (task-calendar/ directory)
COPY . .

# Verify package.json exists
RUN test -f /app/package.json || (echo "ERROR: package.json not found!" && ls -la /app/ && exit 1)

# Install dependencies
RUN npm install

# Generate Prisma
RUN npx prisma generate

# Build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Make scripts executable
RUN chmod a+x /app/run.sh /app/init-db.js /app/start.js

# Set default environment variables (can be overridden at runtime)
ENV HOME_ASSISTANT_URL="http://supervisor/core"
ENV DATABASE_PATH="/data/task-calendar.db"
ENV DATABASE_URL="file:/data/task-calendar.db"

# Expose port
EXPOSE 3000

# Run node directly - ensure we use the correct path
# The start.js script will handle environment variable setup from SUPERVISOR_TOKEN
# Using exec form to ensure proper PID 1 execution
CMD [ "node", "/app/start.js" ]
