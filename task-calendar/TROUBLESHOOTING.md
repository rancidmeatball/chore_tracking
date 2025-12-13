# Troubleshooting Build Issues

## Getting the Actual Error

The Home Assistant supervisor logs contain the actual build error. To view them:

```bash
ha supervisor logs
```

Or via SSH:
```bash
docker logs addon_core_supervisor
```

Look for lines containing "task-calendar" or "96412c9b_task-calendar" to find the specific error.

## Common Issues

### 1. Missing Files
Ensure all required files are in the `task-calendar/` directory:
- `Dockerfile`
- `config.json`
- `build.json`
- `package.json`
- `package-lock.json`
- `next.config.js`
- `tsconfig.json`
- `prisma/schema.prisma`
- `app/` directory
- `components/` directory
- `lib/` directory
- `types/` directory

### 2. Node.js Version Issues
The base image might have an incompatible Node.js version. Check the logs to see what version is being used.

### 3. Prisma Binary Compatibility
Prisma needs to download architecture-specific binaries. Ensure your architecture is supported in `build.json`.

### 4. Build Timeout
Large builds might timeout. Try:
- Reducing dependencies
- Using a simpler build process
- Increasing build timeout in Home Assistant settings

### 5. Memory Issues
The build might be running out of memory. Check supervisor logs for OOM (Out of Memory) errors.

## Testing Locally

You can test the Dockerfile locally before deploying:

```bash
cd task-calendar
docker build -t task-calendar-test --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest .
```

This will show you the actual build error immediately.

## Alternative: Simplified Build

If the build continues to fail, try using `Dockerfile.simple` which has minimal error handling:

```bash
cp Dockerfile.simple Dockerfile
```

Then try installing the add-on again.

