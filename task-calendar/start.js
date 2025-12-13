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

// Next.js standalone build - directly require the server
// This keeps the process as PID 1 (required for s6-overlay)
const standalonePath = '/app/.next/standalone';

if (fs.existsSync(standalonePath)) {
  // Change to standalone directory
  process.chdir(standalonePath);
  
  // Directly require the server - no child processes
  // This process becomes the main process (PID 1)
  require('./server.js');
} else {
  // Fallback: if standalone build doesn't exist, we have a build problem
  console.error('ERROR: Standalone build not found at /app/.next/standalone');
  console.error('Please ensure next.config.js has output: "standalone"');
  console.error('And that npm run build completed successfully');
  process.exit(1);
}

