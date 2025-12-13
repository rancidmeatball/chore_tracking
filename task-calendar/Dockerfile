ARG BUILD_FROM
FROM $BUILD_FROM

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
# Use --include=dev to ensure devDependencies are installed for build
RUN echo "Installing npm dependencies..." && \
    npm install --include=dev --loglevel=verbose || \
    (echo "npm install failed!" && \
     echo "package.json contents:" && cat package.json && \
     echo "npm version:" && npm --version && \
     exit 1)

# Verify Prisma is installed
RUN echo "Verifying Prisma installation..." && \
    npx prisma --version || (echo "Prisma not found!" && exit 1)

# Copy all other files needed for build
COPY . .

# Verify critical files exist
RUN test -f next.config.js || (echo "ERROR: next.config.js not found!" && exit 1) && \
    test -f tsconfig.json || (echo "ERROR: tsconfig.json not found!" && exit 1) && \
    test -d app || (echo "ERROR: app directory not found!" && exit 1)

# Generate Prisma client
RUN echo "Generating Prisma client..." && \
    npx prisma generate || \
    (echo "Prisma generate failed!" && \
     echo "Prisma version:" && npx prisma --version && \
     echo "Schema file:" && cat prisma/schema.prisma && \
     exit 1)

# Verify Prisma client was generated
RUN test -d node_modules/.prisma/client || \
    (echo "ERROR: Prisma client not generated!" && \
     ls -la node_modules/.prisma/ 2>/dev/null || echo "No .prisma directory" && \
     exit 1)

# Build Next.js application
# Don't set NODE_ENV=production during build - we need devDependencies
ENV NEXT_TELEMETRY_DISABLED=1
RUN echo "Building Next.js application..." && \
    npm run build || \
    (echo "npm build failed!" && \
     echo "Checking .next directory:" && ls -la .next/ 2>/dev/null || echo "No .next directory" && \
     exit 1)

# Verify build output exists
RUN if [ ! -d .next ]; then \
        echo "ERROR: .next directory not found!" && \
        exit 1; \
    fi && \
    echo "Build output verified:" && \
    ls -la .next/ | head -10

# Verify static files exist
RUN if [ -d .next/static ]; then \
        echo "Static files found:" && \
        ls -la .next/static/ | head -5; \
    else \
        echo "WARNING: .next/static directory not found"; \
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
