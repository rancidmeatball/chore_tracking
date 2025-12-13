# How to Get the Actual Build Error

The error message you're seeing is just a generic message. To see the actual error, you need to access the supervisor logs.

## Method 1: Via SSH/Terminal (Recommended)

If you have SSH access to your Home Assistant system:

```bash
# Get the last 100 lines of supervisor logs
ha supervisor logs --tail 100

# Or search for task-calendar specific errors
ha supervisor logs | grep -i "task-calendar\|96412c9b\|error\|failed"

# Or view all recent logs
ha supervisor logs --tail 200 | less
```

## Method 2: Via Home Assistant Terminal Add-on

1. Open the Terminal add-on in Home Assistant
2. Run: `ha supervisor logs --tail 100`
3. Look for lines containing "task-calendar", "96412c9b", or "ERROR"

## Method 3: Via Docker (if you have direct access)

```bash
# Find the supervisor container
docker ps | grep supervisor

# View logs
docker logs addon_core_supervisor --tail 100
```

## Method 4: Check Docker Build Logs Directly

The build might be happening in a Docker container. Check:

```bash
# List recent containers
docker ps -a | head -20

# Check logs of any build containers
docker logs <container_id>
```

## What to Look For

Look for error messages containing:
- "ERROR:" (from our Dockerfile)
- "failed" or "Failed"
- "task-calendar" or "96412c9b_task-calendar"
- Any stack traces or detailed error messages

## Common Error Patterns

1. **File not found**: "ERROR: package.json not found!" or similar
2. **npm install failed**: Look for npm error messages
3. **Prisma errors**: "Prisma generate failed!" or binary download issues
4. **Build errors**: "npm build failed!" or Next.js compilation errors
5. **Missing dependencies**: Package installation errors

Once you have the actual error message, share it and we can fix the specific issue!

