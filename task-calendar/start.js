#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Set environment variables from Home Assistant supervisor
// SUPERVISOR_TOKEN is automatically provided by Home Assistant
process.env.HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://supervisor/core';
process.env.HOME_ASSISTANT_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HOME_ASSISTANT_TOKEN || '';

// Use default database path
const dbPath = process.env.DATABASE_PATH || '/data/task-calendar.db';
process.env.DATABASE_URL = `file:${dbPath}`;

// Create data directory if needed
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Use next start directly - simpler and more reliable
// This keeps the process as PID 1 (required for s6-overlay)
const appPath = '/app';
process.chdir(appPath);

// Initialize database if needed
// Prisma doesn't auto-create the schema, so we need to run db push
if (!fs.existsSync(dbPath)) {
  console.log('Database not found, initializing...');
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma db push', {
      cwd: appPath,
      stdio: 'inherit',
      env: process.env
    });
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Continue anyway - might work if schema already exists
  }
}

// Use next start - simpler and more reliable
process.env.PORT = process.env.PORT || '3000';

console.log('Starting Next.js application...');
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Verify .next directory exists
if (!fs.existsSync('/app/.next')) {
  console.error('ERROR: .next directory not found. Build may have failed.');
  process.exit(1);
}

// Use next start via node - this replaces the current process
// For Home Assistant with init: false, we need to exec to replace PID 1
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Start Next.js server
console.log('Executing: npm run start');
exec('npm run start', {
  cwd: '/app',
  env: process.env
}, (error, stdout, stderr) => {
  if (error) {
    console.error('Failed to start Next.js:', error);
    process.exit(1);
  }
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
});

// Keep the process alive
process.stdin.resume();

