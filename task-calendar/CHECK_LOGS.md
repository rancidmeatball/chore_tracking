# How to Check Add-on Logs

The webapp isn't loading. We need to see the actual error logs to diagnose the issue.

## Method 1: Via Home Assistant UI

1. Go to the **Task Calendar** add-on page
2. Click on the **Log** tab
3. Look for error messages

## Method 2: Via SSH/Terminal

```bash
# View add-on logs
ha addons logs task-calendar

# Or view supervisor logs
ha supervisor logs --tail 100 | grep -i "task-calendar\|error\|failed"
```

## What to Look For

Common errors:
- **"ERROR: .next directory not found"** - Build failed
- **"Failed to start Next.js"** - Runtime error
- **"Cannot find module"** - Missing dependency
- **"Port already in use"** - Port conflict
- **"EADDRINUSE"** - Port 3000 already taken

## Check if Server is Running

```bash
# Check if the container is running
docker ps | grep task-calendar

# Check if port 3000 is listening
netstat -tuln | grep 3000
# or
ss -tuln | grep 3000
```

## Common Issues

### 1. Build Failed
- Check build logs for TypeScript errors
- Verify all dependencies installed

### 2. Server Not Starting
- Check if Next.js is installed
- Verify .next directory exists
- Check for runtime errors

### 3. Port Not Accessible
- Verify port mapping in config.json (3000/tcp: 3700)
- Check if port 3700 is accessible from browser
- Try accessing http://homeassistant:3700

## Share the Logs

Once you have the logs, share:
1. Any error messages
2. The last 20-30 lines of the log
3. Whether the container is running

This will help identify the exact issue!

