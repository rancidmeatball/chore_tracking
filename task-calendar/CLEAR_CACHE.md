# How to Clear Home Assistant Add-on Cache

Home Assistant is using a cached Docker image with the old `start.js` code. You need to force a rebuild.

## Method 1: Clear Docker Cache (Recommended)

Via SSH/Terminal:
```bash
# Stop the add-on first
ha addons stop task-calendar

# Remove the old image
docker rmi $(docker images | grep "96412c9b_task-calendar" | awk '{print $3}')

# Or remove all unused images (more aggressive)
docker image prune -a

# Then try installing again
```

## Method 2: Change Repository URL Temporarily

1. Remove the repository from Home Assistant
2. Add it back with a slightly different URL (add `?v=2` or similar)
3. This forces Home Assistant to treat it as a new repository

## Method 3: Update Version and Force Rebuild

The version has been updated to 0.1.3. After refreshing the repository:

1. **Uninstall** the add-on completely
2. **Restart Home Assistant Supervisor** (Settings → System → Hardware → Restart)
3. **Refresh the repository** again
4. **Install** the add-on

## Method 4: Manual Docker Build (Advanced)

If you have SSH access:
```bash
# Build the image manually to verify it works
cd /config/addons/git/rancidmeatball_chore_tracking/task-calendar
docker build --no-cache -t local/task-calendar .
```

## Verify the Fix

After clearing cache and reinstalling, check the logs. You should see:
- "Using Next.js standalone build..." message
- "Standalone directory contents:" with file listing
- No "Cannot find module './server.js'" error

If you still see the old error, the cache wasn't cleared properly.

