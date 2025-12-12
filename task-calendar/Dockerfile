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

# Make run script executable (it's already in /app/run.sh from COPY . .)
RUN chmod a+x /app/run.sh

# Expose port
EXPOSE 3000

# Don't override entrypoint - let Home Assistant base image handle s6-overlay
# Start the application
CMD [ "/app/run.sh" ]
