ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and OpenSSL (required for Prisma)
# Prisma's linux-musl binary requires libssl.so.1.1
# Try to install openssl1.1-compat, fallback to regular openssl if not available
RUN apk add --no-cache nodejs npm openssl && \
    (apk add --no-cache openssl1.1-compat || apk add --no-cache libssl1.1 || echo "OpenSSL 1.1 compat not available, will try symlink") || true

# Find and link OpenSSL libraries for Prisma
RUN LIBSSL=$(find /usr/lib /lib -name "libssl.so*" 2>/dev/null | head -1) && \
    if [ -n "$LIBSSL" ]; then \
      LIBSSL_DIR=$(dirname "$LIBSSL"); \
      if [ ! -f "$LIBSSL_DIR/libssl.so.1.1" ]; then \
        if [ -f "$LIBSSL_DIR/libssl.so.3" ]; then \
          ln -sf "$LIBSSL_DIR/libssl.so.3" "$LIBSSL_DIR/libssl.so.1.1" && \
          echo "Created symlink: $LIBSSL_DIR/libssl.so.1.1 -> $LIBSSL_DIR/libssl.so.3"; \
        elif [ -f "$LIBSSL_DIR/libssl.so.1.1.1" ]; then \
          ln -sf "$LIBSSL_DIR/libssl.so.1.1.1" "$LIBSSL_DIR/libssl.so.1.1" && \
          echo "Created symlink: $LIBSSL_DIR/libssl.so.1.1 -> $LIBSSL_DIR/libssl.so.1.1.1"; \
        fi; \
      fi; \
      echo "OpenSSL libraries found in: $LIBSSL_DIR"; \
      ls -la "$LIBSSL_DIR"/libssl.so* || true; \
    else \
      echo "WARNING: No OpenSSL libraries found"; \
    fi

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
# Help Prisma find OpenSSL libraries
ENV LD_LIBRARY_PATH="/usr/lib:/lib:${LD_LIBRARY_PATH:-}"

# Expose port
EXPOSE 3000

# Don't override ENTRYPOINT - let Home Assistant base image handle it
# With init: false, the base image should not use s6-overlay
# Run node directly - this becomes PID 1
CMD [ "node", "/app/start.js" ]
