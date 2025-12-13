ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and OpenSSL (required for Prisma)
# Prisma's linux-musl binary requires libssl.so.1.1
RUN apk add --no-cache nodejs npm openssl openssl1.1-compat

# Set working directory
WORKDIR /app

# Copy all files from build context (task-calendar/ directory)
COPY . .

# Verify package.json exists
RUN test -f /app/package.json || (echo "ERROR: package.json not found!" && ls -la /app/ && exit 1)

# Install dependencies
RUN echo "Installing npm dependencies..." && \
    npm install || (echo "npm install failed!" && exit 1)

# Generate Prisma
RUN echo "Generating Prisma client..." && \
    npx prisma generate || (echo "Prisma generate failed!" && exit 1)

# Build
ENV NEXT_TELEMETRY_DISABLED=1
RUN echo "Building Next.js application..." && \
    npm run build || (echo "npm build failed!" && exit 1)

# Make scripts executable (only if they exist)
RUN if [ -f /app/run.sh ]; then chmod a+x /app/run.sh; fi && \
    if [ -f /app/init-db.js ]; then chmod a+x /app/init-db.js; fi && \
    if [ -f /app/start.js ]; then chmod a+x /app/start.js; fi

# Set default environment variables (can be overridden at runtime)
ENV HOME_ASSISTANT_URL="http://supervisor/core"
ENV DATABASE_PATH="/data/task-calendar.db"
ENV DATABASE_URL="file:/data/task-calendar.db"
# Help Prisma find OpenSSL libraries
ENV LD_LIBRARY_PATH="/usr/lib:/lib:${LD_LIBRARY_PATH:-}"

# Expose port
EXPOSE 3000

# Don't override ENTRYPOINT - let Home Assistant base image handle it
# With init: false, the base image should not use s6-overlay
# Run node directly - this becomes PID 1
CMD [ "node", "/app/start.js" ]
