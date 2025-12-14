ARG BUILD_FROM
FROM ${BUILD_FROM}

# Cache bust: 2025-12-14 - Force rebuild for Vite migration
ARG CACHE_BUST=2025-12-14-20-30
RUN echo "Cache bust: ${CACHE_BUST}"

# Install Node.js and build dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    openssl \
    python3 \
    make \
    g++

# Verify Node.js and npm versions
RUN node --version && npm --version

# Set working directory
WORKDIR /app

# Copy package files first for better caching
ARG CACHE_BUST_COPY=2025-12-14-20-30
COPY package*.json ./
COPY prisma ./prisma/

# Verify files were copied
RUN test -f package.json || (echo "ERROR: package.json not found!" && exit 1) && \
    test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found!" && exit 1)

# Install dependencies
ARG CACHE_BUST_NPM=2025-12-14-20-30
RUN echo "Cache bust npm: ${CACHE_BUST_NPM}" && \
    echo "Node version:" && node --version && \
    echo "NPM version:" && npm --version && \
    echo "=== Starting npm install ===" && \
    npm install --include=dev --loglevel=error 2>&1 || \
    (echo "=== npm install FAILED ===" && \
     echo "Exit code: $$?" && \
     cat package.json && \
     exit 1) && \
    echo "=== npm install SUCCESS ==="

# Verify Prisma is installed
RUN echo "Verifying Prisma installation..." && \
    npx prisma --version || (echo "Prisma not found!" && exit 1)

# Copy all other files needed for build
ARG CACHE_BUST_COPY_FILES=2025-12-14-20-30
COPY . .

# Verify critical files exist (Vite migration - no Next.js)
RUN test -f vite.config.ts || (echo "ERROR: vite.config.ts not found!" && exit 1) && \
    test -f tsconfig.json || (echo "ERROR: tsconfig.json not found!" && exit 1) && \
    test -d src || (echo "ERROR: src directory not found!" && exit 1) && \
    test -f server.js || (echo "ERROR: server.js not found!" && exit 1) && \
    test -f index.html || (echo "ERROR: index.html not found!" && exit 1) && \
    echo "=== Verifying Vite config ===" && \
    cat vite.config.ts && \
    echo "=== Verifying server.js exists ===" && \
    head -5 server.js

# Generate Prisma client
RUN echo "Generating Prisma client..." && \
    rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true && \
    npx prisma generate || \
    (echo "Prisma generate failed!" && exit 1)

# Verify Prisma client was generated
RUN if [ ! -d node_modules/.prisma/client ]; then \
        echo "ERROR: Prisma client not generated!" && exit 1; \
    fi

# Build Vite frontend (NOT Next.js)
ENV NODE_ENV=production
RUN echo "=== Building Vite frontend (migrated from Next.js) ===" && \
    echo "This is NOT a Next.js build - it's Vite!" && \
    npm run build > /tmp/build.log 2>&1; BUILD_EXIT=$$?; \
    echo "=== BUILD OUTPUT ==="; \
    cat /tmp/build.log; \
    if [ $$BUILD_EXIT -ne 0 ]; then \
        echo "=== BUILD FAILED (exit code: $$BUILD_EXIT) ==="; \
        echo "=== Checking for TypeScript errors ==="; \
        npx tsc --noEmit 2>&1 | head -20 || true; \
        exit 1; \
    fi && \
    echo "=== BUILD SUCCEEDED ===" && \
    echo "=== Checking dist directory ===" && \
    ls -la dist/ | head -10 && \
    echo "=== Verifying dist/index.html exists ===" && \
    test -f dist/index.html && echo "✓ dist/index.html exists" || echo "✗ dist/index.html NOT FOUND"

# Verify build output exists
RUN if [ ! -d dist ]; then \
        echo "ERROR: dist directory not found!" && exit 1; \
    fi && \
    if [ ! -f dist/index.html ]; then \
        echo "ERROR: dist/index.html not found!" && exit 1; \
    fi && \
    echo "✓ Build output verified"

# Make scripts executable
RUN chmod +x start.js init-db.js run.sh 2>/dev/null || true

# Set default environment variables
ENV HOME_ASSISTANT_URL="http://supervisor/core"
ENV DATABASE_PATH="/data/task-calendar.db"
ENV DATABASE_URL="file:/data/task-calendar.db"
ENV LD_LIBRARY_PATH="/usr/lib:/lib"
ENV NODE_ENV="production"
ENV PORT="3001"
ENV NODE_ENV="production"

# Expose port (Express server, not Next.js)
EXPOSE 3001

# Run start script
CMD [ "node", "start.js" ]
