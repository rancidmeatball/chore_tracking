ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm ci

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
