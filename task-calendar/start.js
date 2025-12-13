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

// Use next start - simpler and more reliable than standalone mode
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Starting Next.js application...');
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Verify .next directory exists
if (!fs.existsSync('/app/.next')) {
  console.error('ERROR: .next directory not found. Build may have failed.');
  console.error('Current directory:', process.cwd());
  console.error('Files in /app:', fs.readdirSync('/app').join(', '));
  process.exit(1);
}

// Check for server files
const serverFiles = ['server.js', 'server.mjs'];
let serverFile = null;
for (const file of serverFiles) {
  const path = `/app/.next/${file}`;
  if (fs.existsSync(path)) {
    serverFile = path;
    console.log(`Found server file: ${serverFile}`);
    break;
  }
}

if (!serverFile) {
  console.warn('WARNING: No server file found in .next directory');
  console.log('Contents of .next:', fs.readdirSync('/app/.next').join(', '));
}

// Check if standalone build exists
const standalonePath = '/app/.next/standalone';
if (fs.existsSync(standalonePath)) {
  console.log('Standalone build detected');
  console.log('Contents of standalone:', fs.readdirSync(standalonePath).join(', '));
}

// Check static files
const staticPath = '/app/.next/static';
if (fs.existsSync(staticPath)) {
  console.log('Static files found at:', staticPath);
} else {
  console.warn('WARNING: Static files not found at:', staticPath);
}

// Use next start - execSync will block and keep the process running
// This is fine for Home Assistant add-ons
const { execSync } = require('child_process');
try {
  console.log('Executing: npm run start');
  execSync('npm run start', {
    cwd: '/app',
    stdio: 'inherit',
    env: process.env
  });
} catch (error) {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
}

