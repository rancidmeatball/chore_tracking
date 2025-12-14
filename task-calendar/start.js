#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
    } catch (e) {
      console.log('Could not read manifest:', e.message);
    }
  } else {
    console.warn('WARNING: app-paths-manifest.json not found');
  }
} else {
  console.error('ERROR: /app/.next/server directory not found!');
}

// Use spawn to keep the process running and handle signals properly
// This ensures the process stays alive and handles SIGTERM/SIGINT correctly
const { spawn } = require('child_process');

console.log('Executing: next start');
console.log('Current working directory:', process.cwd());
console.log('.next directory exists:', fs.existsSync('/app/.next'));
console.log('.next/server/app exists:', fs.existsSync('/app/.next/server/app'));

// Next.js needs -H 0.0.0.0 to bind to all interfaces, not just localhost
// Also ensure we're in the right directory and Next.js can find .next
const nextProcess = spawn('node_modules/.bin/next', ['start', '-H', '0.0.0.0'], {
  cwd: '/app',
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    HOSTNAME: '0.0.0.0',
    // Ensure Next.js can find the build output
    NEXT_PRIVATE_STANDALONE: 'false',
  }
});

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

