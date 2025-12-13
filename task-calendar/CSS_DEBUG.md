# CSS Not Loading - Debugging Steps

## Quick Check in Browser

1. **Open Developer Tools** (F12)
2. **Go to Network tab**
3. **Filter by CSS** (or look for `.css` files)
4. **Reload the page**
5. **Check if CSS files are being requested:**
   - If you see CSS files with **404 errors** → CSS files aren't being generated
   - If you see CSS files with **200 OK** → CSS is being served but not applied (different issue)
   - If you see **no CSS files** → CSS isn't being generated at all

## Common Issues

### 1. CSS Files Not Generated
**Symptom**: 404 errors for CSS files in Network tab
**Fix**: Check build logs to see if Tailwind/PostCSS processed the CSS

### 2. CSS Files Not Served
**Symptom**: CSS files exist but return 404
**Fix**: Check if static files are in the correct location

### 3. CSS Path Issues
**Symptom**: CSS files requested from wrong path
**Fix**: Check Next.js configuration

## Check Add-on Logs

Look for:
- "Static files found" messages
- "CSS files found" messages
- Any errors during build

## Temporary Fix

If CSS still doesn't work, we might need to:
1. Move Tailwind/PostCSS to dependencies (not devDependencies)
2. Ensure CSS is extracted during build
3. Check Next.js CSS handling configuration

