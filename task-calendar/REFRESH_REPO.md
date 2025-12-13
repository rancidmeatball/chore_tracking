# How to Refresh the Repository in Home Assistant

Home Assistant is still using the old Dockerfile with `openssl1.1-compat`. You need to refresh the repository.

## If Using Git Repository:

1. **Commit and push your changes:**
   ```bash
   cd /Users/john/chore_tracking
   git add task-calendar/Dockerfile
   git commit -m "Fix: Remove openssl1.1-compat package"
   git push
   ```

2. **Refresh the repository in Home Assistant:**
   - Go to: **Settings** → **Add-ons** → **Add-on Store**
   - Click the **three dots (⋮)** in the top right
   - Select **Repositories**
   - Find your repository and click **Reload** or the refresh icon
   - Or remove and re-add the repository

3. **Try installing again**

## If Using Local Repository:

1. Make sure the files are in the correct location that Home Assistant is reading from
2. Restart the Home Assistant Supervisor:
   ```bash
   ha supervisor reload
   ```
   Or via UI: **Settings** → **System** → **Hardware** → **Three dots** → **Restart**

## Clear Build Cache (if needed):

If the issue persists, you might need to clear Docker build cache:

```bash
# Via SSH/Terminal
docker system prune -a --volumes
```

**Warning:** This will remove all unused Docker images and containers.

## Verify the Fix:

After refreshing, check the supervisor logs again. The error should change - it should either:
- Progress past the package installation step
- Show a different error (which we can then fix)

The Dockerfile is now correct and should work!

