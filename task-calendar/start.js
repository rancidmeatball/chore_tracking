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

// Database will be initialized automatically by Prisma on first connection
// No need to run db push here - Prisma handles SQLite database creation

// Next.js standalone build - find and require the server
// This keeps the process as PID 1 (required for s6-overlay)
const standalonePath = '/app/.next/standalone';
const appPath = '/app';

if (fs.existsSync(standalonePath)) {
  // Change to standalone directory
  process.chdir(standalonePath);
  
  // Check for server.js in current directory
  let serverPath = './server.js';
  if (!fs.existsSync(serverPath)) {
    // List what's actually in the directory for debugging
    console.error('ERROR: server.js not found in standalone build');
    console.error('Looking in:', process.cwd());
    console.error('Contents:');
    try {
      const files = fs.readdirSync('.');
      files.forEach(file => {
        const stat = fs.statSync(file);
        console.error(`  ${stat.isDirectory() ? 'DIR' : 'FILE'}: ${file}`);
      });
    } catch (e) {
      console.error('Could not read directory:', e.message);
    }
    
    // Fallback: try using next start from the app directory
    console.log('Falling back to next start...');
    process.chdir(appPath);
    const { spawn } = require('child_process');
    const child = spawn('node', ['node_modules/.bin/next', 'start'], {
      cwd: appPath,
      stdio: 'inherit',
      env: process.env
    });
    child.on('exit', (code) => process.exit(code || 0));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    process.on('SIGINT', () => child.kill('SIGINT'));
    return;
  }
  
  // Directly require the server - no child processes
  // This process becomes the main process (PID 1)
  require(serverPath);
} else {
  // Fallback: use regular next start if standalone build doesn't exist
  console.log('Standalone build not found, using next start...');
  process.chdir(appPath);
  const { spawn } = require('child_process');
  const child = spawn('node', ['node_modules/.bin/next', 'start'], {
    cwd: appPath,
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => process.exit(code || 0));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

