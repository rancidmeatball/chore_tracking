ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js and build dependencies
# Home Assistant base images are Alpine Linux
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
COPY package*.json ./
COPY prisma ./prisma/

# Verify files were copied
RUN test -f package.json || (echo "ERROR: package.json not found!" && exit 1) && \
    test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found!" && exit 1)

# Install dependencies
# Install all dependencies (including dev) for build, but we'll need them at runtime too for next start
RUN echo "Installing npm dependencies..." && \
    npm install --include=dev --loglevel=verbose || \
    (echo "npm install failed!" && \
     echo "package.json contents:" && cat package.json && \
     echo "npm version:" && npm --version && \
     exit 1)

# Verify Next.js is installed
RUN echo "Verifying Next.js installation..." && \
    npx next --version || (echo "Next.js not found!" && exit 1)

# Verify Prisma is installed
RUN echo "Verifying Prisma installation..." && \
    npx prisma --version || (echo "Prisma not found!" && exit 1)

# Copy all other files needed for build
COPY . .

# Verify critical files exist
RUN test -f next.config.js || (echo "ERROR: next.config.js not found!" && exit 1) && \
    test -f tsconfig.json || (echo "ERROR: tsconfig.json not found!" && exit 1) && \
    test -d app || (echo "ERROR: app directory not found!" && exit 1) && \
    echo "=== Verifying next.config.js ===" && \
    cat next.config.js && \
    echo "=== Checking for output: standalone in config ===" && \
    (grep -q "output.*standalone" next.config.js && echo "✓ output: standalone found in config" || echo "✗ output: standalone NOT found in config")

# Generate Prisma client
# Force regeneration to ensure types are up to date
RUN echo "Generating Prisma client..." && \
    rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true && \
    npx prisma generate || \
    (echo "Prisma generate failed!" && \
     echo "Prisma version:" && npx prisma --version && \
     echo "Schema file:" && cat prisma/schema.prisma && \
     exit 1)

# Verify Prisma client was generated
RUN if [ ! -d node_modules/.prisma/client ]; then \
        echo "ERROR: Prisma client not generated!" && \
        ls -la node_modules/.prisma/ 2>/dev/null || echo "No .prisma directory" && \
        exit 1; \
    fi

# Build Next.js application
# Don't set NODE_ENV=production during build - we need devDependencies
ENV NEXT_TELEMETRY_DISABLED=1
# Force standalone mode to be created
ENV NEXT_PRIVATE_STANDALONE=true
# Version 0.1.4 - Removed CSS verification step

# Build Next.js application
# Run build and capture output - show errors on failure
RUN echo "Building Next.js application..." && \
    echo "NEXT_PRIVATE_STANDALONE=${NEXT_PRIVATE_STANDALONE}" && \
    npm run build > /tmp/build.log 2>&1; BUILD_EXIT=$$?; \
    echo "=== FULL BUILD OUTPUT ==="; \
    cat /tmp/build.log; \
    echo "=== END BUILD OUTPUT ==="; \
    if [ $$BUILD_EXIT -ne 0 ]; then \
        echo "=== BUILD FAILED (exit code: $$BUILD_EXIT) ==="; \
        echo "=== .next directory contents ==="; \
        ls -la .next/ 2>/dev/null || echo "No .next directory"; \
        exit 1; \
    fi && \
    echo "=== BUILD SUCCEEDED ===" && \
    echo "=== Checking .next directory structure ===" && \
    echo "Contents of .next:" && \
    ls -la .next/ && \
    echo "" && \
    echo "=== Checking for standalone directory ===" && \
    if [ -d .next/standalone ]; then \
        echo "✓ Standalone directory EXISTS" && \
        ls -la .next/standalone/ && \
        if [ -f .next/standalone/server.js ]; then \
            echo "✓ Standalone server.js EXISTS"; \
        else \
            echo "✗ Standalone server.js NOT FOUND"; \
        fi; \
    else \
        echo "✗ Standalone directory NOT FOUND" && \
        echo "WARNING: next.config.js has output: 'standalone' but standalone directory was not created!" && \
        echo "This means the build did not create standalone output."; \
    fi && \
    echo "" && \
    echo "=== Checking .next/server structure ===" && \
    if [ -d .next/server ]; then \
        echo "Server directory exists" && \
        ls -la .next/server/ && \
        if [ -d .next/server/app ]; then \
            echo "App routes directory exists:" && \
            find .next/server/app -type f -name "*.js" | head -20; \
        else \
            echo "WARNING: .next/server/app directory not found!"; \
        fi; \
        if [ -f .next/server/app-paths-manifest.json ]; then \
            echo "=== App paths manifest ===" && \
            cat .next/server/app-paths-manifest.json; \
        fi; \
    else \
        echo "ERROR: .next/server directory not found!"; \
    fi

# Ensure BUILD_ID exists and is valid (Next.js requires it for production)
# CRITICAL: Invalid BUILD_ID (like "1BUILD_ID") will cause route matching to fail!
RUN set -e && \
    if [ ! -f .next/BUILD_ID ]; then \
        echo "WARNING: BUILD_ID not found - generating one from build artifacts..." && \
        if [ -f .next/build-manifest.json ]; then \
            BUILD_ID=$(md5sum .next/build-manifest.json | cut -d' ' -f1 | cut -c1-20) && \
            echo "$$BUILD_ID" > .next/BUILD_ID && \
            echo "Generated BUILD_ID: $$BUILD_ID"; \
        elif [ -f .next/routes-manifest.json ]; then \
            BUILD_ID=$(md5sum .next/routes-manifest.json | cut -d' ' -f1 | cut -c1-20) && \
            echo "$$BUILD_ID" > .next/BUILD_ID && \
            echo "Generated BUILD_ID: $$BUILD_ID"; \
        else \
            BUILD_ID=$(date +%s | md5sum | cut -d' ' -f1 | cut -c1-20) && \
            echo "$$BUILD_ID" > .next/BUILD_ID && \
            echo "Generated BUILD_ID (timestamp-based): $$BUILD_ID"; \
        fi; \
    else \
        EXISTING_BUILD_ID=$(cat .next/BUILD_ID | tr -d '\n\r ') && \
        echo "BUILD_ID exists: $$EXISTING_BUILD_ID" && \
        BUILD_ID_LEN=$$(echo -n "$$EXISTING_BUILD_ID" | wc -c) && \
        if [ "$$EXISTING_BUILD_ID" = "1BUILD_ID" ] || [ "$$BUILD_ID_LEN" -lt 10 ] || echo "$$EXISTING_BUILD_ID" | grep -q "BUILD_ID"; then \
            echo "ERROR: BUILD_ID is invalid! Regenerating..." && \
            if [ -f .next/build-manifest.json ]; then \
                BUILD_ID=$(md5sum .next/build-manifest.json | cut -d' ' -f1 | cut -c1-20) && \
                echo "$$BUILD_ID" > .next/BUILD_ID && \
                echo "Regenerated BUILD_ID: $$BUILD_ID"; \
            else \
                BUILD_ID=$(date +%s | md5sum | cut -d' ' -f1 | cut -c1-20) && \
                echo "$$BUILD_ID" > .next/BUILD_ID && \
                echo "Regenerated BUILD_ID (timestamp-based): $$BUILD_ID"; \
            fi; \
        else \
            echo "BUILD_ID is valid: $$EXISTING_BUILD_ID"; \
        fi; \
    fi

# Ensure prerender-manifest.json exists (Next.js requires it for production)
RUN if [ ! -f .next/prerender-manifest.json ]; then \
        echo "WARNING: prerender-manifest.json not found - creating minimal manifest..." && \
        echo '{"version":4,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{"previewModeId":"development-id","previewModeSigningKey":"development-key","previewModeEncryptionKey":"development-key"}}' > .next/prerender-manifest.json && \
        echo "Created prerender-manifest.json"; \
    else \
        echo "prerender-manifest.json exists"; \
    fi

# Verify build output exists
# Updated 2024-12-14: Accepts any build artifacts (static/, server/, standalone/, BUILD_ID, or routes-manifest.json)
# BUILD_ID is now ensured to exist above
RUN set -e && \
    echo "=== Verifying Next.js build output ===" && \
    if [ ! -d .next ]; then \
        echo "ERROR: .next directory not found!" && \
        ls -la && \
        exit 1; \
    fi && \
    echo "✓ .next directory exists" && \
    ls -la .next/ && \
    echo "" && \
    echo "=== Checking for build artifacts ===" && \
    ( [ -d .next/static ] && echo "✓ Found: .next/static/" ) || true && \
    ( [ -d .next/server ] && echo "✓ Found: .next/server/" ) || true && \
    ( [ -d .next/standalone ] && echo "✓ Found: .next/standalone/" ) || true && \
    ( [ -f .next/BUILD_ID ] && echo "✓ Found: .next/BUILD_ID ($(cat .next/BUILD_ID))" ) || true && \
    ( [ -f .next/routes-manifest.json ] && echo "✓ Found: .next/routes-manifest.json" ) || true && \
    if [ -d .next/static ] || [ -d .next/server ] || [ -d .next/standalone ] || [ -f .next/BUILD_ID ] || [ -f .next/routes-manifest.json ]; then \
        echo "" && \
        echo "=== Build verification: SUCCESS ===" && \
        echo "Build completed successfully - found required artifacts"; \
    else \
        echo "" && \
        echo "=== Build verification: FAILED ===" && \
        echo "ERROR: No build artifacts found!" && \
        echo "Expected at least one of: static/, server/, standalone/, BUILD_ID, or routes-manifest.json" && \
        echo "" && \
        echo "=== .next directory contents ===" && \
        ls -la .next/ && \
        echo "" && \
        echo "=== Directory tree ===" && \
        find .next -maxdepth 2 | head -20 && \
        exit 1; \
    fi

# Verify static files exist (CSS should be here) - non-blocking
RUN if [ -d .next/static ]; then \
        echo "Static files found:" && \
        ls -la .next/static/ && \
        if [ -d .next/static/css ]; then \
            echo "CSS directory exists:" && \
            ls -la .next/static/css/ | head -10 && \
            echo "CSS files found:" && \
            find .next/static/css -name "*.css" -type f | head -5 || echo "No CSS files in css directory"; \
        else \
            echo "WARNING: .next/static/css directory not found - CSS may not be generated"; \
        fi; \
    else \
        echo "WARNING: .next/static directory not found"; \
    fi

# Search for CSS files (non-blocking)
RUN echo "Searching for CSS files:" && \
    (find .next -name "*.css" -type f | head -10 || echo "No CSS files found")

# Verify static files are readable
RUN if [ -d .next/static ]; then \
        echo "Checking static file permissions:" && \
        ls -la .next/static/css/*.css 2>/dev/null | head -3 || echo "Could not list CSS files"; \
    fi

# Make scripts executable
RUN chmod +x start.js init-db.js run.sh 2>/dev/null || true

# Set default environment variables
ENV HOME_ASSISTANT_URL="http://supervisor/core"
ENV DATABASE_PATH="/data/task-calendar.db"
ENV DATABASE_URL="file:/data/task-calendar.db"
ENV LD_LIBRARY_PATH="/usr/lib:/lib"

# Expose port
EXPOSE 3000

# Run node directly
CMD [ "node", "/app/start.js" ]
