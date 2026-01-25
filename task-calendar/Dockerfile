ARG BUILD_FROM
FROM ${BUILD_FROM}

# Cache bust: 2026-01-25 - Force rebuild for version 0.1.55
ARG CACHE_BUST=2026-01-25-06-00-v0.1.55
RUN echo "Cache bust: ${CACHE_BUST}" && \
    echo "Building version 0.1.55 - CRITICAL FIX: Ensure dist directory persists in final image"

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
ARG CACHE_BUST_COPY=2026-01-25-06-00-v0.1.55
COPY package*.json ./
COPY prisma ./prisma/

# Verify files were copied
RUN test -f package.json || (echo "ERROR: package.json not found!" && exit 1) && \
    test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found!" && exit 1)

# Install dependencies
ARG CACHE_BUST_NPM=2026-01-25-06-00-v0.1.55
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
ARG CACHE_BUST_COPY_FILES=2026-01-25-06-00-v0.1.55
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
ARG CACHE_BUST_BUILD=2026-01-25-06-00-v0.1.55-DIST-FIX
ENV NODE_ENV=production
RUN echo "=== FORCING FRONTEND REBUILD ===" && \
    echo "Build cache bust: ${CACHE_BUST_BUILD}" && \
    echo "Version: 0.1.55 - CRITICAL: dist directory must persist" && \
    echo "Cache invalidation: v2-$(date +%s)" && \
    echo "This is NOT a Next.js build - it's Vite!" && \
    rm -rf dist node_modules/.vite 2>/dev/null || true && \
    touch /tmp/build-timestamp-$(date +%s) && \
    echo "Current directory contents:" && \
    ls -la . | head -10 && \
    echo "=== Running TypeScript check ===" && \
    npx tsc --noEmit 2>&1 | tee /tmp/tsc.log; TSC_STATUS=$$? && \
    if [ $$TSC_STATUS -ne 0 ]; then \
        echo "=== TYPESCRIPT CHECK FAILED (exit code: $$TSC_STATUS) ===" && \
        cat /tmp/tsc.log && \
        exit 1; \
    fi && \
    echo "TypeScript check passed" && \
    echo "=== Running npm run build ===" && \
    npm run build 2>&1 | tee /tmp/build.log; BUILD_STATUS=$$? && \
    if [ $$BUILD_STATUS -ne 0 ]; then \
        echo "=== BUILD FAILED (exit code: $$BUILD_STATUS) ===" && \
        cat /tmp/build.log && \
        exit 1; \
    fi && \
    echo "=== BUILD OUTPUT ===" && \
    cat /tmp/build.log && \
    echo "=== Checking build result ===" && \
    echo "Current working directory: $(pwd)" && \
    echo "Listing current directory:" && \
    ls -la . && \
    if [ ! -d dist ]; then \
        echo "ERROR: dist directory not found after build!" && \
        echo "Build log (last 50 lines):" && \
        tail -50 /tmp/build.log && \
        echo "Checking if vite build created any output:" && \
        find . -name "index.html" -o -name "dist" -type d 2>/dev/null | head -10 && \
        exit 1; \
    fi && \
    echo "Dist directory found, contents:" && \
    ls -la dist/ && \
    if [ ! -f dist/index.html ]; then \
        echo "ERROR: dist/index.html not found after build!" && \
        echo "Dist directory contents:" && \
        ls -la dist/ || echo "dist directory does not exist" && \
        exit 1; \
    fi && \
    echo "=== BUILD SUCCEEDED ===" && \
    echo "Dist directory contents:" && \
    ls -la dist/ | head -10 && \
    echo "✓ dist/index.html exists" && \
    echo "✓ Build output verified" && \
    echo "=== VERIFYING VERSION IN BUILT FILES ===" && \
    grep -r "0.1.55" dist/ || echo "WARNING: Version 0.1.55 not found in dist files" && \
    echo "=== VERIFYING DELETE BUTTON CODE ===" && \
    grep -r "DELETE.*child.name.toUpperCase" dist/ || echo "WARNING: Delete button code not found in dist files" && \
    echo "=== FINAL VERIFICATION: Ensuring dist persists ===" && \
    ls -la dist/ && \
    echo "Dist directory size:" && \
    du -sh dist/ && \
    echo "=== Creating dist persistence marker ===" && \
    touch dist/.docker-build-complete && \
    echo "Build completed at: $(date)" > dist/.docker-build-complete

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

# CRITICAL: Verify dist exists and create a marker file to ensure it persists
RUN echo "=== FINAL DIST VERIFICATION ===" && \
    if [ ! -d dist ]; then \
        echo "CRITICAL ERROR: dist directory does not exist!" && \
        echo "Current directory:" && pwd && \
        echo "Directory contents:" && ls -la && \
        exit 1; \
    fi && \
    if [ ! -f dist/index.html ]; then \
        echo "CRITICAL ERROR: dist/index.html does not exist!" && \
        echo "Dist contents:" && ls -la dist/ && \
        exit 1; \
    fi && \
    echo "✓ Dist directory verified" && \
    echo "✓ dist/index.html exists" && \
    echo "Dist directory size:" && du -sh dist/ && \
    echo "Creating persistence marker..." && \
    echo "Build completed: $(date)" > dist/.build-complete && \
    echo "Version: 0.1.55" >> dist/.build-complete && \
    cat dist/.build-complete

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
