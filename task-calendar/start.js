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

// Try to use standalone server.js first, fallback to next start
const standalonePath = '/app/.next/standalone';
const serverJsPath = path.join(standalonePath, 'server.js');

// Set PORT environment variable
process.env.PORT = process.env.PORT || '3000';

// Check if standalone build exists and has server.js
if (fs.existsSync(standalonePath) && fs.existsSync(serverJsPath)) {
  console.log('Using Next.js standalone build...');
  console.log('Standalone directory contents:');
  try {
    const files = fs.readdirSync(standalonePath);
    files.forEach(file => {
      const fullPath = path.join(standalonePath, file);
      const stat = fs.statSync(fullPath);
      console.log(`  ${stat.isDirectory() ? 'DIR' : 'FILE'}: ${file}`);
    });
  } catch (e) {
    console.error('Could not read standalone directory:', e.message);
  }
  
  // Change to standalone directory - required for Next.js standalone mode
  process.chdir(standalonePath);
  console.log('Changed working directory to:', process.cwd());
  console.log('Starting Next.js standalone server from:', serverJsPath);
  
  // Use absolute path to require server.js
  require(serverJsPath);
} else {
  // Fallback: use next start (should work if standalone build exists but structure is different)
  console.log('Standalone server.js not found, using next start...');
  if (!fs.existsSync('/app/.next')) {
    console.error('ERROR: .next directory not found. Build may have failed.');
    process.exit(1);
  }
  
  // Use next start command
  const { execSync } = require('child_process');
  try {
    execSync('npm run start', {
      cwd: '/app',
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    console.error('Failed to start Next.js:', error);
    process.exit(1);
  }
}

