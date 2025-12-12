ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Home Assistant should build from repository root
# Copy all files from build context
COPY . .

# Debug: Show what was copied
RUN echo "=== Files in /app ===" && ls -la /app/ | head -20
RUN echo "=== Looking for package.json ===" && find /app -maxdepth 2 -name "package.json" -type f || echo "package.json not found in /app or subdirectories"

# Verify package.json exists (should be at /app/package.json if build context is repo root)
RUN test -f /app/package.json || (echo "ERROR: package.json not found! Build context may be wrong." && ls -la /app/ && exit 1)

# Install dependencies
RUN npm install

# Generate Prisma
RUN npx prisma generate

# Build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Copy run script from the already copied files (it's at /app/addon/run.sh)
RUN cp addon/run.sh /run.sh && chmod a+x /run.sh

# Expose port
EXPOSE 3000

# Start the application
CMD [ "/run.sh" ]
