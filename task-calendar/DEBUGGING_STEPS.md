# Debugging the Build Error

## Critical: Get the Actual Error Message

The error you're seeing is just a generic message. **You MUST get the detailed logs** to see what's actually failing.

### Quick Command (if you have SSH/terminal access):

```bash
ha supervisor logs --tail 200 | grep -i "task-calendar\|error\|failed" -A 5 -B 5
```

This will show the last 200 lines filtered for errors related to task-calendar.

## Common Build Failures & Quick Fixes

### 1. Missing Files Error
**Symptom**: "ERROR: package.json not found!" or similar
**Fix**: Ensure all files are committed and pushed to your repository

### 2. npm install Fails
**Symptom**: "npm install failed!" in logs
**Possible causes**:
- Network issues downloading packages
- Package version conflicts
- Missing package-lock.json

**Quick fix**: Try the simplified Dockerfile:
```bash
cp Dockerfile.simple Dockerfile
```

### 3. Prisma Generate Fails
**Symptom**: "Prisma generate failed!" in logs
**Possible causes**:
- Architecture mismatch (Prisma binary not available)
- OpenSSL library issues
- Network issues downloading Prisma binaries

**Quick fix**: The Dockerfile already includes openssl1.1-compat, but you might need to check the architecture.

### 4. Next.js Build Fails
**Symptom**: "npm build failed!" in logs
**Possible causes**:
- TypeScript errors
- Missing dependencies
- Memory issues

**Check**: Look for TypeScript compilation errors in the logs

### 5. Standalone Output Missing
**Symptom**: "ERROR: Standalone output not found!"
**Fix**: Ensure `next.config.js` has `output: 'standalone'` (it does)

## Repository Structure Check

Your add-on should be in: `task-calendar/` directory

Required files:
- ✅ `Dockerfile`
- ✅ `config.json` 
- ✅ `build.json`
- ✅ `package.json`
- ✅ All source files

## Next Steps

1. **Get the actual error** using the command above
2. **Share the error message** - it will tell us exactly what's wrong
3. **Check the build context** - ensure Home Assistant can access all files

## If You Can't Access Logs

If you can't access the supervisor logs directly, try:

1. **Check Home Assistant UI**: Settings → Add-ons → System → Supervisor → Logs
2. **Use the Terminal add-on**: Install it if you don't have it, then run the log commands
3. **Check Docker directly**: If you have shell access to the host system

The actual error message will be very specific and will tell us exactly what step is failing!

