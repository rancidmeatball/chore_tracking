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

# Expose port
EXPOSE 3000

# Use shell script which execs node (required for s6-overlay PID 1)
CMD [ "/app/run.sh" ]
