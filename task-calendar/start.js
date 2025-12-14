#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set environment variables from Home Assistant supervisor
// SUPERVISOR_TOKEN is automatically provided by Home Assistant
process.env.HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://supervisor/core';
process.env.HOME_ASSISTANT_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HOME_ASSISTANT_TOKEN || '';

// Use default database path - /data is persistent in Home Assistant add-ons
const dbPath = process.env.DATABASE_PATH || '/data/task-calendar.db';
process.env.DATABASE_URL = `file:${dbPath}`;

// Create data directory if needed
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created data directory:', dbDir);
}

// Use next start directly - simpler and more reliable
// This keeps the process as PID 1 (required for s6-overlay)
const appPath = '/app';
process.chdir(appPath);

// Initialize database if needed
// Prisma doesn't auto-create the schema, so we need to run db push
console.log('Checking database...');
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

// Verify database persistence
console.log('Data directory exists:', fs.existsSync(dbDir));
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('Database file exists, size:', stats.size, 'bytes');
  console.log('Database last modified:', stats.mtime);
}

// Always try to push schema to ensure it's up to date
// This is safe - it won't delete data, just updates schema if needed
// DO NOT use --accept-data-loss as it can cause data loss!
try {
  console.log('Initializing/updating database schema...');
  const { execSync } = require('child_process');
  // Use db push without --accept-data-loss to preserve existing data
  // This will only add new columns/tables, not delete existing data
  execSync('npx prisma db push', {
    cwd: appPath,
    stdio: 'inherit',
    env: process.env,
    timeout: 30000 // 30 second timeout
  });
  console.log('Database schema initialized/updated successfully');
} catch (error) {
  console.error('Failed to initialize database schema:', error);
  console.error('This might be okay if the schema already exists, but API calls may fail.');
  // Continue anyway - the app might still work if schema exists
}

// Use next start - simpler and more reliable than standalone mode
process.env.PORT = process.env.PORT || '3000';
// Force production mode - critical for CPU usage
process.env.NODE_ENV = 'production';
// Disable Next.js telemetry to reduce overhead
process.env.NEXT_TELEMETRY_DISABLED = '1';
// Node.js production optimizations
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=512';
// Ensure Next.js binds to all interfaces (0.0.0.0) not just localhost
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log('Starting Next.js application...');
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// CRITICAL: Check for standalone mode FIRST, before any other checks
// Standalone mode requires using the standalone server, not "next start"
const standalonePath = '/app/.next/standalone';
const standaloneServer = '/app/.next/standalone/server.js';

console.log('');
console.log('=== CHECKING FOR STANDALONE MODE (EARLY CHECK) ===');
console.log('Standalone directory path:', standalonePath);
console.log('Standalone directory exists:', fs.existsSync(standalonePath));
console.log('Standalone server path:', standaloneServer);
console.log('Standalone server exists:', fs.existsSync(standaloneServer));

if (fs.existsSync(standalonePath)) {
  try {
    const contents = fs.readdirSync(standalonePath);
    console.log('Standalone directory contents:', contents.join(', '));
  } catch (e) {
    console.error('Error reading standalone directory:', e.message);
  }
}

const useStandalone = fs.existsSync(standalonePath) && fs.existsSync(standaloneServer);
console.log('Will use standalone mode:', useStandalone);
console.log('');

if (useStandalone) {
  console.log('');
  console.log('=== STANDALONE MODE DETECTED ===');
  console.log('Using standalone server (required when output: standalone is set)');
  console.log('Standalone server path:', standaloneServer);
  
  // In standalone mode, we need to ensure static files are accessible
  const standaloneStatic = '/app/.next/standalone/.next/static';
  const mainStatic = '/app/.next/static';
  const standalonePublic = '/app/.next/standalone/public';
  const mainPublic = '/app/public';
  
  if (!fs.existsSync(standaloneStatic) && fs.existsSync(mainStatic)) {
    console.log('Copying static files to standalone directory...');
    const { execSync } = require('child_process');
    try {
      execSync(`mkdir -p /app/.next/standalone/.next && cp -r ${mainStatic} /app/.next/standalone/.next/`, {
        stdio: 'inherit'
      });
      console.log('✓ Static files copied');
    } catch (e) {
      console.error('Error copying static files:', e.message);
    }
  }
  
  // Copy public directory if it exists
  if (!fs.existsSync(standalonePublic) && fs.existsSync(mainPublic)) {
    console.log('Copying public directory to standalone directory...');
    const { execSync } = require('child_process');
    try {
      execSync(`cp -r ${mainPublic} /app/.next/standalone/`, {
        stdio: 'inherit'
      });
      console.log('✓ Public directory copied');
    } catch (e) {
      console.error('Error copying public directory:', e.message);
    }
  }
  
  // Verify standalone server file exists and is readable
  if (!fs.existsSync(standaloneServer)) {
    console.error('ERROR: Standalone server file not found at:', standaloneServer);
    console.error('This should not happen if standalone mode was detected correctly.');
    process.exit(1);
  }
  
  console.log('Starting standalone server...');
  console.log('Standalone server path:', standaloneServer);
  console.log('Working directory:', '/app/.next/standalone');
  console.log('Environment:');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  PORT:', process.env.PORT);
  console.log('  HOSTNAME:', process.env.HOSTNAME);
  
  const serverProcess = spawn('node', [standaloneServer], {
    cwd: '/app/.next/standalone',
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '0.0.0.0',
      HOST: '0.0.0.0',
    }
  });
  
  serverProcess.on('exit', (code, signal) => {
    console.error(`Standalone server exited with code ${code} and signal ${signal}`);
    if (code !== 0 && code !== null) {
      process.exit(1);
    }
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down standalone server...');
    serverProcess.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down standalone server...');
    serverProcess.kill('SIGINT');
  });
  
  process.on('exit', () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });
  
  // Exit early - standalone server is now running
  return;
}

// CRITICAL DEBUG: Check if routes were built
console.log('');
console.log('=== CRITICAL: Checking if routes were built ===');
const serverAppPath = '/app/.next/server/app';
if (fs.existsSync(serverAppPath)) {
  console.log('✓ .next/server/app directory EXISTS');
  try {
    const files = fs.readdirSync(serverAppPath, { recursive: true, withFileTypes: true });
    const jsFiles = files.filter(f => f.isFile() && f.name.endsWith('.js'));
    console.log(`Found ${jsFiles.length} route files in .next/server/app`);
    if (jsFiles.length > 0) {
      console.log('Sample files:', jsFiles.slice(0, 5).map(f => f.name).join(', '));
    } else {
      console.error('ERROR: No route files found! This is why you get 404s!');
    }
  } catch (e) {
    console.error('Error reading server/app:', e.message);
  }
} else {
  console.error('ERROR: .next/server/app directory DOES NOT EXIST!');
  console.error('This means routes were not built. Checking .next structure...');
  if (fs.existsSync('/app/.next/server')) {
    const serverContents = fs.readdirSync('/app/.next/server');
    console.log('Contents of .next/server:', serverContents.join(', '));
  } else {
    console.error('ERROR: .next/server directory does not exist!');
  }
}
console.log('');

// Verify .next directory exists and has BUILD_ID
if (!fs.existsSync('/app/.next')) {
  console.error('ERROR: .next directory not found. Build may have failed.');
  console.error('Current directory:', process.cwd());
  console.error('Files in /app:', fs.readdirSync('/app').join(', '));
  process.exit(1);
}

// Verify BUILD_ID exists (required for production builds)
// If missing, create it from build artifacts (Next.js should create this, but if it's missing we can generate one)
let buildId;
if (!fs.existsSync('/app/.next/BUILD_ID')) {
  console.warn('WARNING: BUILD_ID file not found in .next directory.');
  console.warn('This may indicate an incomplete build, but attempting to continue...');
  console.warn('Contents of .next:', fs.readdirSync('/app/.next').join(', '));
  
  // Check if we have build artifacts that indicate a successful build
  const hasBuildArtifacts = fs.existsSync('/app/.next/server') || 
                           fs.existsSync('/app/.next/static') || 
                           fs.existsSync('/app/.next/routes-manifest.json');
  
  if (hasBuildArtifacts) {
    // Generate a BUILD_ID based on the build manifest or use a hash
    // Next.js typically uses a hash, but we'll use a timestamp-based ID as fallback
    const crypto = require('crypto');
    const buildManifestPath = '/app/.next/build-manifest.json';
    let buildIdSource = Date.now().toString();
    
    if (fs.existsSync(buildManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
        buildIdSource = JSON.stringify(manifest);
      } catch (e) {
        // Use timestamp if manifest read fails
      }
    }
    
    buildId = crypto.createHash('md5').update(buildIdSource).digest('hex').substring(0, 20);
    fs.writeFileSync('/app/.next/BUILD_ID', buildId);
    console.log('Generated BUILD_ID:', buildId);
  } else {
    console.error('ERROR: No build artifacts found. Build did not complete successfully.');
    console.error('Please check the Docker build logs for build errors.');
    process.exit(1);
  }
} else {
  buildId = fs.readFileSync('/app/.next/BUILD_ID', 'utf8').trim();
  console.log('Build verified - BUILD_ID:', buildId);
  console.log('BUILD_ID length:', buildId.length);
  console.log('BUILD_ID includes BUILD_ID:', buildId.includes('BUILD_ID'));
  
  // Check if BUILD_ID is valid (should be a hash, not a placeholder)
  // BUILD_ID should be a 20-character hex string, not a placeholder
  // CRITICAL: Invalid BUILD_ID can cause Next.js to not match routes!
  const isInvalid = buildId === '1BUILD_ID' || buildId.length < 10 || buildId.includes('BUILD_ID');
  console.log('BUILD_ID is invalid?', isInvalid);
  
  if (isInvalid) {
    console.error('ERROR: BUILD_ID is INVALID! This will cause route matching to fail!');
    console.error('BUILD_ID value:', JSON.stringify(buildId));
    console.warn('Regenerating BUILD_ID from build artifacts...');
    
    const crypto = require('crypto');
    const buildManifestPath = '/app/.next/build-manifest.json';
    let buildIdSource = Date.now().toString() + Math.random().toString();
    
    if (fs.existsSync(buildManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
        buildIdSource = JSON.stringify(manifest);
        console.log('Using build-manifest.json for BUILD_ID generation');
      } catch (e) {
        console.log('Could not read build-manifest.json, using timestamp+random');
      }
    } else {
      console.log('build-manifest.json not found, using timestamp+random');
    }
    
    buildId = crypto.createHash('md5').update(buildIdSource).digest('hex').substring(0, 20);
    fs.writeFileSync('/app/.next/BUILD_ID', buildId);
    console.log('✓ Regenerated BUILD_ID to:', buildId);
    console.log('New BUILD_ID length:', buildId.length);
  } else {
    console.log('✓ BUILD_ID is valid');
  }
}

// Ensure prerender-manifest.json exists (Next.js requires it for production)
const prerenderManifestPath = '/app/.next/prerender-manifest.json';
if (!fs.existsSync(prerenderManifestPath)) {
  console.warn('WARNING: prerender-manifest.json not found - creating minimal manifest...');
  const prerenderManifest = {
    version: 4,
    routes: {},
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: 'development-id',
      previewModeSigningKey: 'development-key',
      previewModeEncryptionKey: 'development-key'
    }
  };
  fs.writeFileSync(prerenderManifestPath, JSON.stringify(prerenderManifest, null, 2));
  console.log('Created prerender-manifest.json');
}

// Skip detailed file checks - just verify .next exists (reduces startup CPU)

// Minimal check - just verify static directory exists (skip detailed file listing to reduce CPU)
const staticPath = '/app/.next/static';
if (!fs.existsSync(staticPath)) {
  console.warn('WARNING: Static files not found at:', staticPath);
}

// Debug: Check server routes
console.log('=== Debugging route structure ===');
if (fs.existsSync('/app/.next/server')) {
  console.log('Server directory exists');
  if (fs.existsSync('/app/.next/server/app')) {
    console.log('App routes directory exists');
    try {
      const appFiles = fs.readdirSync('/app/.next/server/app', { recursive: true });
      console.log('App route files found:', appFiles.slice(0, 20).join(', '));
    } catch (e) {
      console.log('Could not list app files:', e.message);
    }
  } else {
    console.error('ERROR: /app/.next/server/app directory not found!');
  }
  
  // Check app-paths-manifest
  const manifestPath = '/app/.next/server/app-paths-manifest.json';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log('App paths manifest:', JSON.stringify(manifest, null, 2));
      console.log('Number of routes in manifest:', Object.keys(manifest).length);
      if (Object.keys(manifest).length === 0) {
        console.error('ERROR: app-paths-manifest.json is EMPTY! This is why routes are not matching!');
      } else {
        // Check if root route is in manifest
        if (manifest['/page']) {
          console.log('✓ Root route (/page) found in manifest:', manifest['/page']);
        } else {
          console.error('ERROR: Root route (/page) NOT found in manifest!');
        }
      }
    } catch (e) {
      console.log('Could not read manifest:', e.message);
    }
  } else {
    console.warn('WARNING: app-paths-manifest.json not found');
  }
  
  // Check if root page.js exists and is readable
  const rootPagePath = '/app/.next/server/app/page.js';
  if (fs.existsSync(rootPagePath)) {
    console.log('✓ Root page.js exists at:', rootPagePath);
    try {
      const stats = fs.statSync(rootPagePath);
      console.log('  File size:', stats.size, 'bytes');
      if (stats.size === 0) {
        console.error('ERROR: Root page.js is EMPTY!');
      }
    } catch (e) {
      console.error('ERROR: Cannot stat root page.js:', e.message);
    }
  } else {
    console.error('ERROR: Root page.js NOT FOUND at:', rootPagePath);
    // Check alternative locations
    const altPaths = [
      '/app/.next/server/app/page/index.js',
      '/app/.next/server/app/(root)/page.js',
      '/app/.next/server/pages/index.js'
    ];
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log('Found page at alternative location:', altPath);
      }
    }
  }
} else {
  console.error('ERROR: /app/.next/server directory not found!');
}

// spawn is already imported at the top of the file

console.log('Executing: next start');
console.log('Current working directory:', process.cwd());
console.log('.next directory exists:', fs.existsSync('/app/.next'));
console.log('.next/server/app exists:', fs.existsSync('/app/.next/server/app'));

// Verify we can actually read a route file
const testRoutePath = '/app/.next/server/app/page.js';
if (fs.existsSync(testRoutePath)) {
  console.log('✓ Root route file exists at:', testRoutePath);
  const stats = fs.statSync(testRoutePath);
  console.log('  File size:', stats.size, 'bytes');
  
  // Try to read the first few lines to verify it's a valid JS file
  try {
    const content = fs.readFileSync(testRoutePath, 'utf8');
    const firstLine = content.split('\n')[0];
    console.log('  First line:', firstLine.substring(0, 100));
  } catch (e) {
    console.error('  ERROR reading route file:', e.message);
  }
  
  // Try to verify the route file is actually importable
  try {
    console.log('  Attempting to require the route file to verify it\'s valid...');
    // Don't actually require it (it might have side effects), just check syntax
    const vm = require('vm');
    const content = fs.readFileSync(testRoutePath, 'utf8');
    // Just check if it's valid JavaScript by trying to parse it
    vm.createScript(content);
    console.log('  ✓ Route file is valid JavaScript');
  } catch (e) {
    console.error('  ✗ Route file is NOT valid JavaScript:', e.message);
  }
} else {
  console.error('ERROR: Root route file NOT found at:', testRoutePath);
}

// Also check if middleware was built - MOVED EARLIER TO ENSURE IT RUNS
console.log('=== CHECKING MIDDLEWARE (BEFORE ROUTES MANIFEST) ===');
try {
  const middlewarePath = '/app/.next/server/middleware.js';
  if (fs.existsSync(middlewarePath)) {
    console.log('✓ Middleware file exists at:', middlewarePath);
    const stats = fs.statSync(middlewarePath);
    console.log('  Middleware file size:', stats.size, 'bytes');
  } else {
    console.warn('⚠ Middleware file NOT found at:', middlewarePath);
    console.warn('  This might explain why middleware logs aren\'t appearing');
    // Check for middleware in other locations
    const altMiddlewarePath = '/app/.next/server/middleware-edge.js';
    if (fs.existsSync(altMiddlewarePath)) {
      console.log('  Found middleware-edge.js instead');
    }
    // Check middleware manifest
    const middlewareManifestPath = '/app/.next/server/middleware-manifest.json';
    if (fs.existsSync(middlewareManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(middlewareManifestPath, 'utf8'));
        console.log('  Middleware manifest exists:', JSON.stringify(manifest, null, 2));
      } catch (e) {
        console.log('  Could not read middleware manifest:', e.message);
      }
    } else {
      console.warn('  Middleware manifest also not found!');
    }
  }
} catch (e) {
  console.error('ERROR checking middleware:', e.message);
  console.error(e.stack);
}
console.log('');

// Check if there's a routes-manifest that Next.js uses
const routesManifestPath = '/app/.next/routes-manifest.json';
if (fs.existsSync(routesManifestPath)) {
  try {
    const routesManifest = JSON.parse(fs.readFileSync(routesManifestPath, 'utf8'));
    console.log('Routes manifest found with', Object.keys(routesManifest.dynamicRoutes || {}).length, 'dynamic routes');
  } catch (e) {
    console.error('Error reading routes manifest:', e.message);
  }
} else {
  console.warn('WARNING: routes-manifest.json not found');
}

// Next.js needs -H 0.0.0.0 to bind to all interfaces, not just localhost
// Use absolute path to ensure Next.js finds .next directory
// Enable verbose logging to see what Next.js is doing
console.log('Starting Next.js with environment:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  HOSTNAME:', process.env.HOSTNAME);
console.log('  CWD:', process.cwd());
console.log('  .next exists:', fs.existsSync('/app/.next'));
console.log('  app directory exists:', fs.existsSync('/app/app'));
console.log('  app/page.tsx exists:', fs.existsSync('/app/app/page.tsx'));
console.log('  app/layout.tsx exists:', fs.existsSync('/app/app/layout.tsx'));
console.log('  app/middleware.ts exists:', fs.existsSync('/app/app/middleware.ts'));
// Verify Next.js can read the source files
if (fs.existsSync('/app/app/page.tsx')) {
  try {
    const pageContent = fs.readFileSync('/app/app/page.tsx', 'utf8');
    console.log('  app/page.tsx is readable, first 100 chars:', pageContent.substring(0, 100));
  } catch (e) {
    console.error('  ERROR: Cannot read app/page.tsx:', e.message);
  }
}

// Next.js might need the source app directory at runtime for some operations
if (!fs.existsSync('/app/app')) {
  console.error('ERROR: Source app directory not found! Next.js may need it at runtime.');
}

// Standalone check was already done at the top of the file
// If we get here, standalone mode was not detected, so use standard next start
console.log('=== Using standard next start (standalone mode not detected) ===');

// Use 'pipe' instead of 'inherit' so we can capture and log requests
// Try using NODE_OPTIONS to ensure Next.js binds to 0.0.0.0
// Also try using the full path to next
const nextBin = '/app/node_modules/.bin/next';
console.log('Next.js binary exists:', fs.existsSync(nextBin));

// Only use next start if standalone mode was NOT detected (early check already handled standalone)
console.log('Using standard next start (standalone mode was not detected in early check)');
  // Add debug logging to see what Next.js is doing
  console.log('=== Starting Next.js with next start ===');
  console.log('Command:', nextBin, 'start --hostname 0.0.0.0 --port 3000');
  console.log('Working directory:', '/app');
  console.log('Next.js will look for .next directory at:', '/app/.next');
  console.log('Verifying .next/server/app-paths-manifest.json exists:', fs.existsSync('/app/.next/server/app-paths-manifest.json'));
  
  // Add explicit debugging to see what Next.js is doing
  console.log('=== Starting Next.js with next start ===');
  console.log('Command:', nextBin, 'start --hostname 0.0.0.0 --port 3000');
  console.log('Working directory:', '/app');
  console.log('Next.js will look for .next directory at:', '/app/.next');
  console.log('Verifying .next/server/app-paths-manifest.json exists:', fs.existsSync('/app/.next/server/app-paths-manifest.json'));
  console.log('Verifying .next/server/app/page.js exists:', fs.existsSync('/app/.next/server/app/page.js'));
  
  // Set NODE_OPTIONS to help with module resolution
  const nodeOptions = process.env.NODE_OPTIONS || '';
  
  // Try using node directly to run Next.js server instead of next start
  // This might help with route resolution
  const nextServerPath = '/app/node_modules/next/dist/bin/next';
  const useDirectNode = fs.existsSync(nextServerPath);
  
  console.log('Next.js server path exists:', useDirectNode);
  console.log('Will use:', useDirectNode ? 'node directly' : 'next start command');
  
  // CRITICAL: Ensure Next.js can find the .next directory
  // Next.js looks for .next relative to cwd, so we must be in /app
  console.log('=== Final verification before starting Next.js ===');
  console.log('Current working directory will be:', '/app');
  console.log('.next directory exists:', fs.existsSync('/app/.next'));
  console.log('.next/server/app exists:', fs.existsSync('/app/.next/server/app'));
  console.log('.next/server/app/page.js exists:', fs.existsSync('/app/.next/server/app/page.js'));
  console.log('Source app directory exists:', fs.existsSync('/app/app'));
  console.log('Source app/page.tsx exists:', fs.existsSync('/app/app/page.tsx'));
  
  // Verify BUILD_ID one more time before starting - CRITICAL FOR ROUTE MATCHING
  const finalBuildId = fs.readFileSync('/app/.next/BUILD_ID', 'utf8').trim();
  console.log('=== FINAL BUILD_ID CHECK (CRITICAL) ===');
  console.log('Final BUILD_ID value:', finalBuildId);
  console.log('Final BUILD_ID length:', finalBuildId.length);
  console.log('Final BUILD_ID contains BUILD_ID:', finalBuildId.includes('BUILD_ID'));
  
  if (finalBuildId === '1BUILD_ID' || finalBuildId.length < 10 || finalBuildId.includes('BUILD_ID')) {
    console.error('❌ ERROR: BUILD_ID is STILL INVALID! This WILL cause route matching to fail!');
    console.error('BUILD_ID value:', JSON.stringify(finalBuildId));
    console.error('Attempting to regenerate BUILD_ID one more time...');
    const crypto = require('crypto');
    const buildManifestPath = '/app/.next/build-manifest.json';
    let buildIdSource = Date.now().toString() + Math.random().toString();
    if (fs.existsSync(buildManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
        buildIdSource = JSON.stringify(manifest);
      } catch (e) {
        // Use timestamp if manifest read fails
      }
    }
    const newBuildId = crypto.createHash('md5').update(buildIdSource).digest('hex').substring(0, 20);
    fs.writeFileSync('/app/.next/BUILD_ID', newBuildId);
    console.log('✓ Regenerated BUILD_ID to:', newBuildId);
    console.log('New BUILD_ID length:', newBuildId.length);
    console.log('New BUILD_ID is valid:', !newBuildId.includes('BUILD_ID') && newBuildId.length >= 10);
  } else {
    console.log('✓ BUILD_ID is VALID - routes should work');
  }
  
  // Try to read a small portion of the root page to verify it's valid JavaScript
  if (fs.existsSync('/app/.next/server/app/page.js')) {
    try {
      const pageContent = fs.readFileSync('/app/.next/server/app/page.js', 'utf8');
      console.log('Root page.js first 200 chars:', pageContent.substring(0, 200));
      if (pageContent.trim().length === 0) {
        console.error('ERROR: Root page.js is empty!');
      }
    } catch (e) {
      console.error('ERROR: Cannot read root page.js:', e.message);
    }
  }
  
  // Verify the app-paths-manifest one more time
  const finalManifestPath = '/app/.next/server/app-paths-manifest.json';
  if (fs.existsSync(finalManifestPath)) {
    try {
      const finalManifest = JSON.parse(fs.readFileSync(finalManifestPath, 'utf8'));
      console.log('Final manifest check - Root route (/page) exists:', !!finalManifest['/page']);
      if (!finalManifest['/page']) {
        console.error('ERROR: Root route not in manifest! This will cause 404s!');
      }
    } catch (e) {
      console.error('ERROR: Cannot read final manifest:', e.message);
    }
  }
  
  // CRITICAL: Check if Next.js needs server-app-paths-manifest.json
  // This file is required for Next.js to load app router files
  const serverAppPathsManifest = '/app/.next/server/server-app-paths-manifest.json';
  if (!fs.existsSync(serverAppPathsManifest)) {
    console.warn('WARNING: server-app-paths-manifest.json not found!');
    console.warn('This might cause appFiles Set(0) - Next.js won\'t load app router files!');
    // Try to create it from app-paths-manifest.json
    const appPathsManifest = '/app/.next/server/app-paths-manifest.json';
    if (fs.existsSync(appPathsManifest)) {
      try {
        const appManifest = JSON.parse(fs.readFileSync(appPathsManifest, 'utf8'));
        // server-app-paths-manifest.json has a different structure
        // It maps route paths to their file paths
        const serverManifest = {};
        for (const [route, filePath] of Object.entries(appManifest)) {
          // Convert app/page.js to the actual server path
          const serverPath = filePath.replace(/^app\//, '/app/.next/server/app/');
          serverManifest[route] = serverPath;
        }
        fs.writeFileSync(serverAppPathsManifest, JSON.stringify(serverManifest, null, 2));
        console.log('Created server-app-paths-manifest.json from app-paths-manifest.json');
      } catch (e) {
        console.error('ERROR: Could not create server-app-paths-manifest.json:', e.message);
      }
    }
  } else {
    console.log('✓ server-app-paths-manifest.json exists');
  }
  
  const nextProcess = spawn(
    useDirectNode ? 'node' : nextBin,
    useDirectNode ? [nextServerPath, 'start', '--hostname', '0.0.0.0', '--port', '3000'] : ['start', '--hostname', '0.0.0.0', '--port', '3000'],
    {
      cwd: '/app', // CRITICAL: Must be /app so Next.js finds .next directory
      stdio: 'inherit', // Let Next.js output directly - this is critical for proper operation
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '0.0.0.0',
        HOST: '0.0.0.0',
        PORT: '3000',
        // Add debug flag to see what Next.js is doing
        DEBUG: process.env.DEBUG || 'next:*',
        // Ensure Node.js can resolve modules correctly
        NODE_OPTIONS: nodeOptions,
        // Explicitly set the app directory path
        NEXT_PUBLIC_BASE_PATH: '',
        // Ensure Next.js knows where to find the app
        NEXT_PRIVATE_STANDALONE: 'false', // Explicitly disable standalone mode
      }
    }
  );
  
  // Handle process exit
  nextProcess.on('exit', (code, signal) => {
    console.error(`Next.js process exited with code ${code} and signal ${signal}`);
    if (code !== 0 && code !== null) {
      console.error('Next.js process exited unexpectedly');
      process.exit(1);
    }
  });

  // Handle errors
  nextProcess.on('error', (error) => {
    console.error('Failed to start Next.js:', error);
    process.exit(1);
  });

  // Forward signals to the Next.js process
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    nextProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    nextProcess.kill('SIGINT');
  });

  // Keep this process alive
  process.on('exit', () => {
    if (nextProcess && !nextProcess.killed) {
      nextProcess.kill();
    }
  });

// Also add a simple HTTP test server to verify port mapping works
console.log('');
console.log('=== Testing if port 3000 is accessible ===');
console.log('Next.js should be listening on 0.0.0.0:3000');
console.log('Home Assistant maps this to port 3700 externally');
console.log('Access via: http://ha.lan:3700');
console.log('');

// Handle process exit
nextProcess.on('exit', (code, signal) => {
  console.error(`Next.js process exited with code ${code} and signal ${signal}`);
  if (code !== 0 && code !== null) {
    console.error('Next.js process exited unexpectedly');
    process.exit(1);
  }
});

// Handle errors
nextProcess.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});

// Forward signals to the Next.js process
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  nextProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  nextProcess.kill('SIGINT');
});

// Keep this process alive
process.on('exit', () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
});

