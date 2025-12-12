#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Set environment variables
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

// Determine which command to run
let command, args, cwd;

if (fs.existsSync('/app/.next/standalone')) {
  // Standalone build
  cwd = '/app/.next/standalone';
  command = 'node';
  args = ['server.js'];
} else {
  // Regular build
  cwd = '/app';
  command = 'npm';
  args = ['start'];
}

// Change directory
process.chdir(cwd);

// For standalone build, require the server directly (stays as PID 1)
// For npm start, we'll need to handle it differently
if (command === 'node' && args[0] === 'server.js') {
  // Direct require - this process stays as PID 1
  require('./server.js');
} else {
  // For npm, we need to use child_process but keep this as PID 1
  // This might cause issues, so prefer standalone build
  const { spawn } = require('child_process');
  const child = spawn(command, args, {
    cwd: cwd,
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('exit', (code) => process.exit(code || 0));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

