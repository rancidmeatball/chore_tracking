# Simple Cache Clearing Steps

## If Add-on is Not Installed:

1. **Refresh the repository** in Home Assistant:
   - Settings → Add-ons → Add-on Store
   - Click three dots (⋮) → Repositories
   - Find your repository and click Reload/Refresh

2. **Install the add-on** - it should use the new version (0.1.3)

## If Add-on is Installed:

### Method 1: Via Home Assistant UI
1. Go to the add-on page
2. Click **Uninstall** (this removes the container and image)
3. Refresh the repository
4. **Install** again

### Method 2: Via SSH/Terminal
```bash
# List all add-ons to find the correct name
ha addons list

# Look for "task-calendar" or similar
# Then uninstall it
ha addons uninstall <addon-slug>

# Or if it shows as installed but with a different name:
ha addons uninstall 96412c9b_task-calendar
```

### Method 3: Clear All Docker Images
```bash
# List images
docker images

# Remove specific image (look for task-calendar or 96412c9b)
docker rmi <image_id>

# Or remove all unused images
docker image prune -a -f
```

## After Clearing Cache:

1. **Refresh repository** in Home Assistant
2. **Install the add-on** - it will rebuild with the new code
3. Check logs to verify it's using the new start.js

The new version (0.1.3) uses `next start` which should work reliably.

