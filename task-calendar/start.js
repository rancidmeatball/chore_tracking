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

// Use standalone server.js directly (as recommended by Next.js)
// This keeps the process as PID 1 (required for s6-overlay)
const standalonePath = '/app/.next/standalone';
const serverJsPath = path.join(standalonePath, 'server.js');

if (fs.existsSync(serverJsPath)) {
  console.log('Starting Next.js standalone server from:', serverJsPath);
  process.chdir(standalonePath);
  
  // Set PORT environment variable (Next.js uses PORT or defaults to 3000)
  process.env.PORT = process.env.PORT || '3000';
  
  // Directly require the server - no child processes
  // This process becomes the main process (PID 1)
  require('./server.js');
} else {
  console.error('ERROR: Standalone server.js not found at:', serverJsPath);
  console.error('Standalone directory exists:', fs.existsSync(standalonePath));
  if (fs.existsSync(standalonePath)) {
    console.error('Contents of standalone directory:');
    try {
      const files = fs.readdirSync(standalonePath);
      files.forEach(file => {
        const fullPath = path.join(standalonePath, file);
        const stat = fs.statSync(fullPath);
        console.error(`  ${stat.isDirectory() ? 'DIR' : 'FILE'}: ${file}`);
      });
    } catch (e) {
      console.error('Could not read standalone directory:', e.message);
    }
  }
  process.exit(1);
}

