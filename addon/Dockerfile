ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy all files from build context (addon/ directory)
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

# Copy run script from the already copied files (it's at /app/addon/run.sh)
RUN cp addon/run.sh /run.sh && chmod a+x /run.sh

# Expose port
EXPOSE 3000

# Start the application
CMD [ "/run.sh" ]
