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

console.log('Starting Next.js application...');
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

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

// Use next start directly - more efficient than npm run start
// execSync will block and keep the process running
// This is fine for Home Assistant add-ons
const { execSync } = require('child_process');
try {
  console.log('Executing: next start');
  // Use next start directly instead of npm run start to avoid npm overhead
  execSync('node_modules/.bin/next start', {
    cwd: '/app',
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    }
  });
} catch (error) {
  console.error('Failed to start Next.js:', error);
  console.error('Error details:', error.message);
  if (error.stderr) {
    console.error('stderr:', error.stderr.toString());
  }
  if (error.stdout) {
    console.error('stdout:', error.stdout.toString());
  }
  // Wait a bit before exiting to allow logs to flush
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

