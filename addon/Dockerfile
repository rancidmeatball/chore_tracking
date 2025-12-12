ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy all files (Home Assistant builds from repo root)
COPY . .

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
