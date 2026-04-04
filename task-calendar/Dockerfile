ARG BUILD_FROM
FROM ${BUILD_FROM}

# Cache bust: 2026-04-03 - Force rebuild for version 0.1.71
ARG CACHE_BUST=2026-04-03-v0.1.71
RUN echo "Cache bust: ${CACHE_BUST}" && \
    echo "Building version 0.1.71"

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
ARG CACHE_BUST_COPY=2026-04-03-v0.1.71
COPY package*.json ./
COPY prisma ./prisma/

# Verify files were copied
RUN test -f package.json || (echo "ERROR: package.json not found!" && exit 1) && \
    test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found!" && exit 1)

# Install dependencies
ARG CACHE_BUST_NPM=2026-04-03-v0.1.71
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
ARG CACHE_BUST_COPY_FILES=2026-04-03-v0.1.71
RUN echo "Copy cache bust: ${CACHE_BUST_COPY_FILES}"
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
# Cache bust timestamp - update this to force rebuild  
ARG CACHE_BUST_BUILD=2026-04-03-v0.1.71
ENV NODE_ENV=production

# Clean previous builds
RUN echo "=== FORCING FRONTEND REBUILD ===" && \
    echo "Build cache bust: ${CACHE_BUST_BUILD}" && \
    echo "Version: 0.1.71" && \
    rm -rf dist node_modules/.vite 2>/dev/null || true

# TypeScript check
RUN echo "=== Running TypeScript check ===" && \
    npx tsc --noEmit || (echo "TypeScript check failed!" && exit 1) && \
    echo "TypeScript check passed"

# Build frontend
RUN echo "=== Running npm run build ===" && \
    npm run build || (echo "Build failed!" && exit 1) && \
    echo "Build completed"

# Verify build output
RUN echo "=== Verifying build output ===" && \
    if [ ! -d dist ]; then \
        echo "ERROR: dist directory not found!" && \
        ls -la . && \
        exit 1; \
    fi && \
    if [ ! -f dist/index.html ]; then \
        echo "ERROR: dist/index.html not found!" && \
        ls -la dist/ && \
        exit 1; \
    fi && \
    echo "✓ dist directory exists" && \
    echo "✓ dist/index.html exists" && \
    ls -la dist/ | head -10

# Create persistence marker
RUN echo "Build completed: $(date)" > dist/.build-complete && \
    echo "Version: 0.1.71" >> dist/.build-complete && \
    cat dist/.build-complete

# Final verification that dist exists before moving on
RUN echo "=== PRE-FINAL CHECK: Verifying dist still exists ===" && \
    if [ ! -d dist ]; then \
        echo "CRITICAL ERROR: dist directory missing before final steps!" && \
        exit 1; \
    fi && \
    if [ ! -f dist/index.html ]; then \
        echo "CRITICAL ERROR: dist/index.html missing before final steps!" && \
        exit 1; \
    fi && \
    echo "✓ Dist directory verified before final steps" && \
    ls -la dist/ | head -5


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
