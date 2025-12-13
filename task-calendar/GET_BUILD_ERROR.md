# How to Get the Build Error

The build is failing but we need the actual error message to fix it.

## Get the Error:

### Via SSH/Terminal:
```bash
ha supervisor logs --tail 200 | grep -i "task-calendar\|error\|failed" -A 10 -B 5
```

### Or view all recent logs:
```bash
ha supervisor logs --tail 300
```

Look for lines containing:
- "task-calendar" or "96412c9b"
- "ERROR:"
- "failed"
- Any stack traces

## What to Share:

Once you have the logs, share:
1. The specific error message
2. Which step failed (npm install, prisma generate, npm build, etc.)
3. Any stack traces or detailed error messages

This will tell us exactly what's wrong so we can fix it!

