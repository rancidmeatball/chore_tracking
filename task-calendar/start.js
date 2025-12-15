#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting Task Calendar application...');
console.log('PORT:', process.env.PORT || '3001');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'file:/data/task-calendar.db');
console.log('NODE_ENV:', process.env.NODE_ENV || 'production');

// Check database
console.log('Checking database...');
const dbPath = process.env.DATABASE_PATH || '/data/task-calendar.db';
console.log('Database path:', dbPath);
console.log('Database exists:', existsSync(dbPath));

if (existsSync(dirname(dbPath))) {
  console.log('Data directory exists:', true);
  try {
    const stats = statSync(dbPath);
    console.log('Database file exists, size:', stats.size, 'bytes');
    console.log('Database last modified:', stats.mtime.toISOString());
  } catch (e) {
    console.log('Database file does not exist yet');
  }
} else {
  console.log('Data directory does not exist');
}

// Initialize/update database schema
console.log('Initializing/updating database schema...');
try {
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:/data/task-calendar.db' }
  });
  console.log('Database schema initialized/updated successfully');
} catch (error) {
  console.error('Error initializing database:', error.message);
  process.exit(1);
}

// Generate Prisma client if needed
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client generated successfully');
} catch (error) {
  console.error('Error generating Prisma client:', error.message);
  process.exit(1);
}

// Start Express server
console.log('Starting Express server...');
const databaseUrl = process.env.DATABASE_URL || 'file:/data/task-calendar.db';
const databasePath = process.env.DATABASE_PATH || '/data/task-calendar.db';

console.log('Server environment variables:');
console.log('  DATABASE_URL:', databaseUrl);
console.log('  DATABASE_PATH:', databasePath);
console.log('  PORT:', process.env.PORT || '3001');

const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '3001',
    DATABASE_URL: databaseUrl,
    DATABASE_PATH: databasePath,
    HOSTNAME: '0.0.0.0',
    HOST: '0.0.0.0',
  }
});

serverProcess.on('exit', (code, signal) => {
  console.error(`Server process exited with code ${code} and signal ${signal}`);
  if (code !== 0 && code !== null) {
    console.error('Server process exited unexpectedly');
    process.exit(1);
  }
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  serverProcess.kill('SIGINT');
});
