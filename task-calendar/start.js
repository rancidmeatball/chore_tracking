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

if (fs.existsSync(standalonePath)) {
  // Change to standalone directory
  process.chdir(standalonePath);
  
  // Check for server.js in current directory or server subdirectory
  let serverPath = './server.js';
  if (!fs.existsSync(serverPath)) {
    // Try server/server.js (some Next.js versions use this structure)
    if (fs.existsSync('./server/server.js')) {
      serverPath = './server/server.js';
    } else {
      // List what's actually in the directory for debugging
      console.error('ERROR: server.js not found in standalone build');
      console.error('Contents of /app/.next/standalone:');
      try {
        const files = fs.readdirSync('.');
        console.error('Files:', files.join(', '));
      } catch (e) {
        console.error('Could not read directory:', e.message);
      }
      process.exit(1);
    }
  }
  
  // Directly require the server - no child processes
  // This process becomes the main process (PID 1)
  require(serverPath);
} else {
  // Fallback: if standalone build doesn't exist, we have a build problem
  console.error('ERROR: Standalone build not found at /app/.next/standalone');
  console.error('Please ensure next.config.js has output: "standalone"');
  console.error('And that npm run build completed successfully');
  process.exit(1);
}

